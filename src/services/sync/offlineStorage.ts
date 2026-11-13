import { Preferences } from '@capacitor/preferences';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_STARTER_STUDY_IDS, INITIAL_CARDS, MAX_STUDY_CARDS } from '../../data/seedData';
import type {
  CardProgressEntry,
  CardStatus,
  EnglishAccent,
  Flashcard,
  StudyScope,
  ThemeMode,
  UserDeck,
} from '../../types/flashcard';
import { hydrateCard } from '../../utils/deckHelpers';
import { toCanonicalExpressionKey, type LinguisticEngineResult } from '../../utils/linguisticNormalizer';
import { loadUserStudyStats, type UserStudyStats } from '../../utils/studyMetrics';

const DB_NAME = 'ewm_offline_db';
const DB_VERSION = 2;

const PREF_KEYS = {
  workspace: 'ewm_v6_pref_workspace',
  quizSession: 'ewm_v6_pref_quiz_session',
  migratedV6: 'ewm_v6_idb_migrated',
};

const LEGACY_KEYS = {
  customCards: 'ewm_v5_visitor_custom_cards',
  legacyCards: 'ewm_flashcards_v4_cards',
  progressMap: 'ewm_v5_visitor_progress',
  decks: 'ewm_v5_visitor_decks',
  connectedDeckIds: 'ewm_v5_visitor_connected_decks',
  selectedIds: 'ewm_flashcards_v4_selected_ids',
  deletedIds: 'ewm_flashcards_v4_deleted_ids',
  theme: 'ewm_flashcards_v4_theme',
  studyScope: 'ewm_flashcards_v4_study_scope',
  studyStats: 'ewm_v5_study_metrics',
};

export type SyncQueueAction =
  | 'CARD_PROGRESS_UPSERT'
  | 'CUSTOM_CARD_UPSERT'
  | 'CUSTOM_CARD_DELETE'
  | 'DECK_UPSERT'
  | 'DECK_DELETE'
  | 'WORKSPACE_SETTINGS_UPDATE'
  | 'QUIZ_SCORE_UPDATE'
  | 'LEADERBOARD_SCORE_UPSERT'
  | 'LINGUISTIC_CACHE_UPSERT'
  | 'CURATED_GLOBAL_CARD_UPSERT'
  | 'SURVIVAL_STREAK_SYNC';

export interface CachedLinguisticRecord {
  cacheKey: string;
  canonicalKey: string;
  mode: 'CONSULT_TRANSLATE' | 'GRAMMAR_CHECK';
  result: LinguisticEngineResult;
  createdAt: string;
  updatedAt: string;
}

export type SyncQueuePayload =
  | {
      type: 'CARD_PROGRESS_UPSERT';
      cardId: string;
      masteryLevel: CardStatus;
      roundMarked: number;
    }
  | {
      type: 'CUSTOM_CARD_UPSERT';
      card: Flashcard;
    }
  | {
      type: 'CUSTOM_CARD_DELETE';
      cardId: string;
    }
  | {
      type: 'DECK_UPSERT';
      deck: UserDeck;
    }
  | {
      type: 'DECK_DELETE';
      deckId: string;
    }
  | {
      type: 'WORKSPACE_SETTINGS_UPDATE';
      studyScope: StudyScope;
      selectedCardIds: string[];
      connectedDeckIds: string[];
      activeRound: number;
      preferredAccent?: EnglishAccent;
    }
  | {
      type: 'QUIZ_SCORE_UPDATE';
      score: number;
      totalAnswered: number;
      cardId?: string;
      isCorrect?: boolean;
    }
  | {
      type: 'LEADERBOARD_SCORE_UPSERT';
      name: string;
      shortName: string;
      initials: string;
      avatarUrl?: string;
      monthKey: string;
      score: number;
      cardsReviewed: number;
      masteredCount: number;
      reviewCount: number;
      quizScore: number;
      activeDays: number;
      studyTimeMinutes: number;
      minutosEstudados: number;
      statusText: string;
    }
  | {
      type: 'LINGUISTIC_CACHE_UPSERT';
      cacheId: string;
      mode: 'CONSULT_TRANSLATE' | 'GRAMMAR_CHECK';
      canonicalKey: string;
      payloadJson: string;
    }
  | {
      type: 'CURATED_GLOBAL_CARD_UPSERT';
      card: Flashcard;
    }
  | {
      type: 'SURVIVAL_STREAK_SYNC';
      bestStreak: number;
    };

export interface SyncQueueItem {
  id: string;
  dedupeKey: string;
  action: SyncQueueAction;
  payload: SyncQueuePayload;
  updatedAt: string; // ISO 8601 timestamp (Last-Write-Wins)
  synced: boolean;
  attempts: number;
  nextRetryAt: number;
  ownerUid?: string | null;
}

export interface LocalWorkspaceConfig {
  studyScope: StudyScope;
  selectedCardIds: string[];
  connectedDeckIds: string[];
  deletedIds: string[];
  activeRound: number;
  preferredAccent?: EnglishAccent;
  theme: ThemeMode;
  updatedAt: string;
}

export interface LocalQuizSessionSnapshot {
  score: number;
  totalAnswered: number;
  updatedAt: string;
}

export interface OfflineHydratedSnapshot {
  globalCards: Flashcard[];
  customCards: Flashcard[];
  decks: UserDeck[];
  progressMap: Record<string, CardProgressEntry>;
  workspace: LocalWorkspaceConfig;
  quizSession: LocalQuizSessionSnapshot;
  studyStats: UserStudyStats;
  pendingQueueCount: number;
}

interface EwmOfflineDbSchema extends DBSchema {
  global_cards: {
    key: string;
    value: Flashcard;
  };
  custom_cards: {
    key: string;
    value: Flashcard;
  };
  decks: {
    key: string;
    value: UserDeck;
  };
  card_progress: {
    key: string;
    value: CardProgressEntry;
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-dedupe': string;
    };
  };
  kv_meta: {
    key: string;
    value: {
      key: string;
      data: unknown;
      updatedAt: string;
    };
  };
  linguistic_cache: {
    key: string;
    value: CachedLinguisticRecord;
  };
  discovered_school_cards: {
    key: string;
    value: Flashcard;
  };
}

let dbPromise: Promise<IDBPDatabase<EwmOfflineDbSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<EwmOfflineDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<EwmOfflineDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('global_cards')) {
          db.createObjectStore('global_cards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('custom_cards')) {
          db.createObjectStore('custom_cards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('decks')) {
          db.createObjectStore('decks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('card_progress')) {
          db.createObjectStore('card_progress', { keyPath: 'cardId' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('by-dedupe', 'dedupeKey', { unique: false });
        }
        if (!db.objectStoreNames.contains('kv_meta')) {
          db.createObjectStore('kv_meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('linguistic_cache')) {
          db.createObjectStore('linguistic_cache', { keyPath: 'cacheKey' });
        }
        if (!db.objectStoreNames.contains('discovered_school_cards')) {
          db.createObjectStore('discovered_school_cards', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

function detectInitialThemeSync(): ThemeMode {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(LEGACY_KEYS.theme);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }
  return 'light';
}

export function loadLegacyFallbackSync(): {
  customCards: Flashcard[];
  progressMap: Record<string, CardProgressEntry>;
  decks: UserDeck[];
  workspace: LocalWorkspaceConfig;
  studyStats: UserStudyStats;
} {
  let customCards: Flashcard[] = [];
  let progressMap: Record<string, CardProgressEntry> = {};
  let decks: UserDeck[] = [];
  let selectedCardIds: string[] = [...DEFAULT_STARTER_STUDY_IDS];
  let connectedDeckIds: string[] = [];
  let deletedIds: string[] = [];
  let studyScope: StudyScope = 'selected';

  if (typeof window !== 'undefined') {
    try {
      const rawCustom = window.localStorage.getItem(LEGACY_KEYS.customCards);
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom);
        if (Array.isArray(parsed)) customCards = parsed.map(hydrateCard);
      } else {
        const rawLegacy = window.localStorage.getItem(LEGACY_KEYS.legacyCards);
        if (rawLegacy) {
          const parsed: Flashcard[] = JSON.parse(rawLegacy);
          if (Array.isArray(parsed)) {
            customCards = parsed
              .filter((c) => !INITIAL_CARDS.some((ic) => ic.id === c.id))
              .map((c) => hydrateCard({ ...c, origin: 'custom' }));
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const rawProg = window.localStorage.getItem(LEGACY_KEYS.progressMap);
      if (rawProg) {
        const parsed = JSON.parse(rawProg);
        if (parsed && typeof parsed === 'object') progressMap = parsed;
      } else {
        const rawLegacy = window.localStorage.getItem(LEGACY_KEYS.legacyCards);
        if (rawLegacy) {
          const parsed: Flashcard[] = JSON.parse(rawLegacy);
          for (const c of parsed) {
            if (c.status === 'mastered' || c.status === 'review') {
              progressMap[c.id] = {
                cardId: c.id,
                masteryLevel: c.status,
                roundMarked: 1,
                updatedAt: new Date().toISOString(),
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const rawDecks = window.localStorage.getItem(LEGACY_KEYS.decks);
      if (rawDecks) {
        const parsed = JSON.parse(rawDecks);
        if (Array.isArray(parsed)) decks = parsed;
      }
    } catch {
      // ignore
    }

    try {
      const rawConn = window.localStorage.getItem(LEGACY_KEYS.connectedDeckIds);
      if (rawConn) {
        const parsed = JSON.parse(rawConn);
        if (Array.isArray(parsed)) connectedDeckIds = parsed;
      }
    } catch {
      // ignore
    }

    try {
      const rawSel = window.localStorage.getItem(LEGACY_KEYS.selectedIds);
      if (rawSel) {
        const parsed = JSON.parse(rawSel);
        if (Array.isArray(parsed) && parsed.length > 0) {
          selectedCardIds = parsed.slice(0, MAX_STUDY_CARDS);
        }
      }
    } catch {
      // ignore
    }

    try {
      const rawDel = window.localStorage.getItem(LEGACY_KEYS.deletedIds);
      if (rawDel) {
        const parsed = JSON.parse(rawDel);
        if (Array.isArray(parsed)) deletedIds = parsed;
      }
    } catch {
      // ignore
    }

    try {
      const rawScope = window.localStorage.getItem(LEGACY_KEYS.studyScope);
      if (rawScope === 'all' || rawScope === 'decks' || rawScope === 'selected') {
        studyScope = rawScope;
      }
    } catch {
      // ignore
    }
  }

  return {
    customCards,
    progressMap,
    decks,
    workspace: {
      studyScope,
      selectedCardIds,
      connectedDeckIds,
      deletedIds,
      activeRound: 1,
      theme: detectInitialThemeSync(),
      updatedAt: new Date().toISOString(),
    },
    studyStats: loadUserStudyStats(),
  };
}

/**
 * Boots IndexedDB + Capacitor Preferences, automatically migrating legacy localStorage
 * data on first run, and returns the complete local dataset in milliseconds.
 */
export async function hydrateOfflineDatabase(): Promise<OfflineHydratedSnapshot> {
  const legacy = loadLegacyFallbackSync();

  try {
    const db = await getDb();
    const migratedMeta = await db.get('kv_meta', PREF_KEYS.migratedV6);

    if (!migratedMeta) {
      const tx = db.transaction(
        ['custom_cards', 'decks', 'card_progress', 'kv_meta'],
        'readwrite'
      );
      for (const cc of legacy.customCards) {
        await tx.objectStore('custom_cards').put({
          ...cc,
          updatedAt: cc.updatedAt ?? Date.now(),
        });
      }
      for (const deck of legacy.decks) {
        await tx.objectStore('decks').put({
          ...deck,
          updatedAt: deck.updatedAt ?? Date.now(),
        });
      }
      for (const prog of Object.values(legacy.progressMap)) {
        await tx.objectStore('card_progress').put({
          ...prog,
          updatedAt: prog.updatedAt ?? new Date().toISOString(),
        });
      }
      await tx.objectStore('kv_meta').put({
        key: PREF_KEYS.workspace,
        data: legacy.workspace,
        updatedAt: legacy.workspace.updatedAt,
      });
      await tx.objectStore('kv_meta').put({
        key: LEGACY_KEYS.studyStats,
        data: legacy.studyStats,
        updatedAt: new Date().toISOString(),
      });
      await tx.objectStore('kv_meta').put({
        key: PREF_KEYS.migratedV6,
        data: true,
        updatedAt: new Date().toISOString(),
      });
      await tx.done;

      await Preferences.set({
        key: PREF_KEYS.workspace,
        value: JSON.stringify(legacy.workspace),
      }).catch(() => {});
    }

    const [
      globalCards,
      discoveredSchoolCards,
      customCards,
      decks,
      progressEntries,
      wsMeta,
      quizMeta,
      statsMeta,
      allQueueItems,
    ] = await Promise.all([
      db.getAll('global_cards'),
      db.getAll('discovered_school_cards'),
      db.getAll('custom_cards'),
      db.getAll('decks'),
      db.getAll('card_progress'),
      db.get('kv_meta', PREF_KEYS.workspace),
      db.get('kv_meta', PREF_KEYS.quizSession),
      db.get('kv_meta', LEGACY_KEYS.studyStats),
      db.getAll('sync_queue'),
    ]);

    let workspace = (wsMeta?.data as LocalWorkspaceConfig | undefined) ?? null;
    if (!workspace) {
      try {
        const { value } = await Preferences.get({ key: PREF_KEYS.workspace });
        if (value) workspace = JSON.parse(value) as LocalWorkspaceConfig;
      } catch {
        // ignore
      }
    }

    const progressMap: Record<string, CardProgressEntry> = {};
    for (const entry of progressEntries) {
      if (entry?.cardId) {
        progressMap[entry.cardId] = entry;
      }
    }

    const quizSession = (quizMeta?.data as LocalQuizSessionSnapshot | undefined) ?? {
      score: 0,
      totalAnswered: 0,
      updatedAt: new Date().toISOString(),
    };

    const studyStats = (statsMeta?.data as UserStudyStats | undefined) ?? legacy.studyStats;
    const pendingQueueCount = allQueueItems.filter((q) => !q.synced).length;

    const mergedGlobalCards: Flashcard[] = [];
    const seenIds = new Set<string>();
    const seenCanonical = new Set<string>();

    for (const seedCard of INITIAL_CARDS) {
      const ck = toCanonicalExpressionKey(seedCard.term);
      if (ck) seenCanonical.add(ck);
    }

    for (const gc of globalCards) {
      if (!gc?.id || seenIds.has(gc.id)) continue;
      seenIds.add(gc.id);
      const ck = toCanonicalExpressionKey(gc.term);
      if (ck) seenCanonical.add(ck);
      mergedGlobalCards.push(hydrateCard(gc));
    }

    for (const dc of discoveredSchoolCards) {
      if (!dc?.id || seenIds.has(dc.id)) continue;
      const ck = toCanonicalExpressionKey(dc.term);
      if (ck && seenCanonical.has(ck)) continue;
      seenIds.add(dc.id);
      if (ck) seenCanonical.add(ck);
      mergedGlobalCards.push(hydrateCard({ ...dc, origin: 'global', published: true }));
    }

    return {
      globalCards: mergedGlobalCards,
      customCards: customCards.map(hydrateCard),
      decks,
      progressMap,
      workspace: workspace ?? legacy.workspace,
      quizSession,
      studyStats,
      pendingQueueCount,
    };
  } catch {
    return {
      globalCards: [],
      customCards: legacy.customCards,
      decks: legacy.decks,
      progressMap: legacy.progressMap,
      workspace: legacy.workspace,
      quizSession: { score: 0, totalAnswered: 0, updatedAt: new Date().toISOString() },
      studyStats: legacy.studyStats,
      pendingQueueCount: 0,
    };
  }
}

/**
 * Fast local persistence functions (<10ms IndexedDB + Preferences mirror)
 */
export async function saveCardProgressLocal(entry: CardProgressEntry): Promise<void> {
  const stamped: CardProgressEntry = {
    ...entry,
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
  try {
    const db = await getDb();
    await db.put('card_progress', stamped);
  } catch {
    // fallback handled by localStorage mirror in App
  }
}

export async function replaceProgressMapLocal(
  map: Record<string, CardProgressEntry>
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('card_progress', 'readwrite');
    await tx.store.clear();
    for (const entry of Object.values(map)) {
      await tx.store.put({
        ...entry,
        updatedAt: entry.updatedAt || new Date().toISOString(),
      });
    }
    await tx.done;
  } catch {
    // ignore
  }
}

export async function saveCustomCardLocal(card: Flashcard): Promise<void> {
  const stamped: Flashcard = {
    ...card,
    origin: 'custom',
    updatedAt: card.updatedAt ?? Date.now(),
  };
  try {
    const db = await getDb();
    await db.put('custom_cards', stamped);
  } catch {
    // ignore
  }
}

export async function deleteCustomCardLocal(cardId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('custom_cards', cardId);
  } catch {
    // ignore
  }
}

export async function replaceCustomCardsLocal(cards: Flashcard[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('custom_cards', 'readwrite');
    await tx.store.clear();
    for (const card of cards) {
      await tx.store.put({
        ...card,
        origin: 'custom',
        updatedAt: card.updatedAt ?? Date.now(),
      });
    }
    await tx.done;
  } catch {
    // ignore
  }
}

export async function saveGlobalCardsCacheLocal(cards: Flashcard[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('global_cards', 'readwrite');
    await tx.store.clear();
    for (const card of cards) {
      await tx.store.put(card);
    }
    await tx.done;
  } catch {
    // ignore
  }
}

export async function saveDiscoveredSchoolCardLocal(card: Flashcard): Promise<void> {
  try {
    const db = await getDb();
    await db.put('discovered_school_cards', {
      ...card,
      origin: 'global',
      published: true,
      updatedAt: card.updatedAt ?? Date.now(),
    });
  } catch {
    // ignore
  }
}

export async function getDiscoveredSchoolCardsLocal(): Promise<Flashcard[]> {
  try {
    const db = await getDb();
    const items = await db.getAll('discovered_school_cards');
    return items.map(hydrateCard);
  } catch {
    return [];
  }
}

export async function getLinguisticCacheLocal(
  cacheKey: string
): Promise<CachedLinguisticRecord | null> {
  if (!cacheKey) return null;
  try {
    const db = await getDb();
    const entry = await db.get('linguistic_cache', cacheKey);
    return entry ?? null;
  } catch {
    return null;
  }
}

export async function putLinguisticCacheLocal(record: CachedLinguisticRecord): Promise<void> {
  if (!record?.cacheKey) return;
  try {
    const db = await getDb();
    await db.put('linguistic_cache', record);
  } catch {
    // ignore
  }
}

export async function getRecentLinguisticHistoryLocal(
  limit = 6
): Promise<CachedLinguisticRecord[]> {
  try {
    const db = await getDb();
    const all = await db.getAll('linguistic_cache');
    return all
      .sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

export async function saveDeckLocal(deck: UserDeck): Promise<void> {
  const stamped: UserDeck = {
    ...deck,
    updatedAt: deck.updatedAt ?? Date.now(),
  };
  try {
    const db = await getDb();
    await db.put('decks', stamped);
  } catch {
    // ignore
  }
}

export async function deleteDeckLocal(deckId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('decks', deckId);
  } catch {
    // ignore
  }
}

export async function replaceDecksLocal(decks: UserDeck[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('decks', 'readwrite');
    await tx.store.clear();
    for (const d of decks) {
      await tx.store.put({ ...d, updatedAt: d.updatedAt ?? Date.now() });
    }
    await tx.done;
  } catch {
    // ignore
  }
}

export async function saveWorkspaceConfigLocal(config: LocalWorkspaceConfig): Promise<void> {
  const stamped: LocalWorkspaceConfig = {
    ...config,
    updatedAt: config.updatedAt || new Date().toISOString(),
  };
  const serialized = JSON.stringify(stamped);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LEGACY_KEYS.theme, stamped.theme);
      window.localStorage.setItem(LEGACY_KEYS.studyScope, stamped.studyScope);
      window.localStorage.setItem(LEGACY_KEYS.selectedIds, JSON.stringify(stamped.selectedCardIds));
      window.localStorage.setItem(
        LEGACY_KEYS.connectedDeckIds,
        JSON.stringify(stamped.connectedDeckIds)
      );
      window.localStorage.setItem(LEGACY_KEYS.deletedIds, JSON.stringify(stamped.deletedIds));
    } catch {
      // ignore
    }
  }

  void Preferences.set({ key: PREF_KEYS.workspace, value: serialized }).catch(() => {});

  try {
    const db = await getDb();
    await db.put('kv_meta', {
      key: PREF_KEYS.workspace,
      data: stamped,
      updatedAt: stamped.updatedAt,
    });
  } catch {
    // ignore
  }
}

export async function saveQuizSessionLocal(snapshot: LocalQuizSessionSnapshot): Promise<void> {
  const serialized = JSON.stringify(snapshot);
  void Preferences.set({ key: PREF_KEYS.quizSession, value: serialized }).catch(() => {});
  try {
    const db = await getDb();
    await db.put('kv_meta', {
      key: PREF_KEYS.quizSession,
      data: snapshot,
      updatedAt: snapshot.updatedAt,
    });
  } catch {
    // ignore
  }
}

export async function saveStudyStatsLocal(stats: UserStudyStats): Promise<void> {
  try {
    const db = await getDb();
    await db.put('kv_meta', {
      key: LEGACY_KEYS.studyStats,
      data: stats,
      updatedAt: new Date().toISOString(),
    });
    if (typeof stats.survivalBestStreak === 'number' && stats.survivalBestStreak > 0) {
      await db.put('kv_meta', {
        key: 'ewm_v6_survival_best_streak',
        data: { bestStreak: Math.floor(stats.survivalBestStreak) },
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // ignore
  }
}

/**
 * SyncQueue Operations (IndexedDB) with Last-Write-Wins coalescing by `dedupeKey`.
 */
export async function upsertSyncQueueEvent(params: {
  dedupeKey: string;
  action: SyncQueueAction;
  payload: SyncQueuePayload;
  ownerUid?: string | null;
}): Promise<SyncQueueItem> {
  const nowIso = new Date().toISOString();
  const item: SyncQueueItem = {
    id: `sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dedupeKey: params.dedupeKey,
    action: params.action,
    payload: params.payload,
    updatedAt: nowIso,
    synced: false,
    attempts: 0,
    nextRetryAt: 0,
    ownerUid: params.ownerUid ?? null,
  };

  try {
    const db = await getDb();
    const tx = db.transaction('sync_queue', 'readwrite');
    const idx = tx.store.index('by-dedupe');
    const existingList = await idx.getAll(params.dedupeKey);

    // Coalesce any older unsynced event on the same entity (Last-Write-Wins)
    for (const prev of existingList) {
      if (!prev.synced) {
        await tx.store.delete(prev.id);
      }
    }

    await tx.store.put(item);
    await tx.done;
  } catch {
    // ignore IndexedDB quota errors
  }

  return item;
}

export async function getPendingSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const db = await getDb();
    const all = await db.getAll('sync_queue');
    return all
      .filter((item) => !item.synced)
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  } catch {
    return [];
  }
}

export async function markSyncQueueItemSynced(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('sync_queue', id);
  } catch {
    // ignore
  }
}

export async function recordSyncQueueRetryFailure(
  id: string,
  attempts: number,
  nextRetryAt: number
): Promise<void> {
  try {
    const db = await getDb();
    const existing = await db.get('sync_queue', id);
    if (!existing) return;
    await db.put('sync_queue', {
      ...existing,
      attempts,
      nextRetryAt,
    });
  } catch {
    // ignore
  }
}

export async function clearAllUserOfflineDataOnAccountDelete(uid?: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(
      ['custom_cards', 'decks', 'card_progress', 'sync_queue', 'kv_meta'],
      'readwrite'
    );
    await tx.objectStore('custom_cards').clear();
    await tx.objectStore('decks').clear();
    await tx.objectStore('card_progress').clear();

    if (uid) {
      const allQ = await tx.objectStore('sync_queue').getAll();
      for (const q of allQ) {
        if (!q.ownerUid || q.ownerUid === uid) {
          await tx.objectStore('sync_queue').delete(q.id);
        }
      }
    } else {
      await tx.objectStore('sync_queue').clear();
    }

    await tx.objectStore('kv_meta').delete(PREF_KEYS.workspace);
    await tx.objectStore('kv_meta').delete(PREF_KEYS.quizSession);
    await tx.done;
  } catch {
    // ignore
  }

  await Preferences.remove({ key: PREF_KEYS.workspace }).catch(() => {});
  await Preferences.remove({ key: PREF_KEYS.quizSession }).catch(() => {});

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LEGACY_KEYS.customCards);
      window.localStorage.removeItem(LEGACY_KEYS.progressMap);
      window.localStorage.removeItem(LEGACY_KEYS.decks);
      window.localStorage.removeItem(LEGACY_KEYS.connectedDeckIds);
      window.localStorage.removeItem(LEGACY_KEYS.selectedIds);
    } catch {
      // ignore
    }
  }
}
