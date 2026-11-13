import {
  deleteCustomCardFromCloud,
  deleteUserDeckFromCloud,
  publishCuratedSchoolCardInCloud,
  saveCardMastery,
  updateUserWorkspaceSettings,
  upsertCollectiveLinguisticCacheInCloud,
  upsertCustomCard,
  upsertLeaderboardEntryInCloud,
  upsertUserDeck,
  type UpsertLeaderboardPayload,
} from '../firebase';
import type {
  CardProgressEntry,
  CardStatus,
  Flashcard,
  SyncStatus,
  UserDeck,
} from '../../types/flashcard';
import type { LinguisticEngineResult } from '../../utils/linguisticNormalizer';
import { getNetworkSnapshot, subscribeNetworkStatus } from './networkMonitor';
import {
  deleteCustomCardLocal,
  deleteDeckLocal,
  getPendingSyncQueueItems,
  markSyncQueueItemSynced,
  putLinguisticCacheLocal,
  recordSyncQueueRetryFailure,
  saveCardProgressLocal,
  saveCustomCardLocal,
  saveDeckLocal,
  saveDiscoveredSchoolCardLocal,
  saveQuizSessionLocal,
  saveWorkspaceConfigLocal,
  upsertSyncQueueEvent,
  type LocalWorkspaceConfig,
  type SyncQueueItem,
} from './offlineStorage';

export interface SyncEngineSnapshot {
  status: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  label: string;
}

export interface PendingEntitySets {
  pendingProgressIds: Set<string>;
  pendingCustomCardIds: Set<string>;
  pendingDeletedCustomCardIds: Set<string>;
  pendingDeckIds: Set<string>;
  pendingDeletedDeckIds: Set<string>;
  hasPendingWorkspace: boolean;
}

type SyncStateListener = (snapshot: SyncEngineSnapshot) => void;

const listeners = new Set<SyncStateListener>();

let activeUid: string | null = null;
let cloudAuthorized = false;
let isFlushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let cachedPendingItems: SyncQueueItem[] = [];
let lastSyncedAt: string | null = null;
let hadRecentError = false;
let networkUnsubscribed = false;

function computeStatusAndLabel(): { status: SyncStatus; label: string; isOnline: boolean } {
  const isOnline = getNetworkSnapshot().connected;
  const pendingCount = cachedPendingItems.length;

  if (!isOnline) {
    return {
      status: 'offline',
      isOnline: false,
      label:
        pendingCount > 0
          ? `Modo Offline • ${pendingCount} ${pendingCount === 1 ? 'item salvo' : 'itens salvos'} no dispositivo`
          : 'Modo Offline • Salvo no dispositivo',
    };
  }

  if (!activeUid) {
    return {
      status: 'visitor',
      isOnline: true,
      label: 'Visitante • Salvo no dispositivo',
    };
  }

  if (!cloudAuthorized) {
    return {
      status: 'visitor',
      isOnline: true,
      label: 'Salvo no dispositivo • Confirme seu e-mail para nuvem',
    };
  }

  if (isFlushing) {
    return {
      status: 'syncing',
      isOnline: true,
      label: 'Sincronizando...',
    };
  }

  if (hadRecentError && pendingCount > 0) {
    return {
      status: 'error',
      isOnline: true,
      label: 'Instabilidade na rede • Salvo no dispositivo',
    };
  }

  if (pendingCount > 0) {
    return {
      status: 'syncing',
      isOnline: true,
      label: 'Sincronizando pendências...',
    };
  }

  return {
    status: 'synced',
    isOnline: true,
    label: 'Sincronizado',
  };
}

function buildSnapshot(): SyncEngineSnapshot {
  const { status, label, isOnline } = computeStatusAndLabel();
  return {
    status,
    isOnline,
    pendingCount: cachedPendingItems.length,
    lastSyncedAt,
    label,
  };
}

function notifyListeners(): void {
  const snap = buildSnapshot();
  listeners.forEach((listener) => {
    try {
      listener(snap);
    } catch {
      // ignore
    }
  });
}

async function refreshPendingCache(): Promise<SyncQueueItem[]> {
  cachedPendingItems = await getPendingSyncQueueItems();
  notifyListeners();
  return cachedPendingItems;
}

function computeExponentialBackoffMs(attempts: number): number {
  const base = 1200;
  const maxDelay = 60000;
  const exp = Math.min(maxDelay, base * Math.pow(2, Math.max(0, attempts - 1)));
  const jitter = Math.floor(Math.random() * 450);
  return Math.min(maxDelay, exp + jitter);
}

function scheduleFlush(delayMs = 220): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSyncQueue();
  }, delayMs);
}

function scheduleRetry(delayMs: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushSyncQueue(true);
  }, delayMs);
}

async function executeQueueItemOnCloud(uid: string, item: SyncQueueItem): Promise<void> {
  const payload = item.payload;

  switch (payload.type) {
    case 'CARD_PROGRESS_UPSERT':
      await saveCardMastery(uid, payload.cardId, payload.masteryLevel, payload.roundMarked);
      return;

    case 'CUSTOM_CARD_UPSERT':
      await upsertCustomCard(uid, payload.card);
      return;

    case 'CUSTOM_CARD_DELETE':
      await deleteCustomCardFromCloud(uid, payload.cardId);
      return;

    case 'DECK_UPSERT':
      await upsertUserDeck(uid, payload.deck);
      return;

    case 'DECK_DELETE':
      await deleteUserDeckFromCloud(uid, payload.deckId);
      return;

    case 'WORKSPACE_SETTINGS_UPDATE':
      await updateUserWorkspaceSettings(uid, {
        studyScope: payload.studyScope,
        selectedCardIds: payload.selectedCardIds,
        connectedDeckIds: payload.connectedDeckIds,
        activeRound: payload.activeRound,
        preferredAccent: payload.preferredAccent,
      });
      return;

    case 'QUIZ_SCORE_UPDATE':
      // Quiz session score is persisted locally in IndexedDB + Preferences and acknowledged cleanly
      return;

    case 'LEADERBOARD_SCORE_UPSERT':
      await upsertLeaderboardEntryInCloud(uid, {
        name: payload.name,
        shortName: payload.shortName,
        initials: payload.initials,
        avatarUrl: payload.avatarUrl,
        monthKey: payload.monthKey,
        score: payload.score,
        cardsReviewed: payload.cardsReviewed,
        masteredCount: payload.masteredCount,
        reviewCount: payload.reviewCount,
        quizScore: payload.quizScore,
        activeDays: payload.activeDays,
        studyTimeMinutes: payload.studyTimeMinutes,
        minutosEstudados: payload.minutosEstudados,
        statusText: payload.statusText,
      });
      return;

    case 'LINGUISTIC_CACHE_UPSERT':
      await upsertCollectiveLinguisticCacheInCloud(uid, {
        cacheId: payload.cacheId,
        mode: payload.mode,
        canonicalKey: payload.canonicalKey,
        payloadJson: payload.payloadJson,
      });
      return;

    case 'CURATED_GLOBAL_CARD_UPSERT':
      await publishCuratedSchoolCardInCloud(uid, payload.card);
      return;
  }
}

/**
 * Flushes all pending `SyncQueue` mutations in chronological Last-Write-Wins order
 * with exponential backoff retry when network connectivity is unstable.
 */
export async function flushSyncQueue(ignoreBackoffWindow = false): Promise<void> {
  if (isFlushing) return;

  const items = await refreshPendingCache();
  if (items.length === 0) {
    hadRecentError = false;
    notifyListeners();
    return;
  }

  if (!getNetworkSnapshot().connected || !activeUid || !cloudAuthorized) {
    notifyListeners();
    return;
  }

  const uid = activeUid;
  isFlushing = true;
  notifyListeners();

  let earliestNextRetry = Infinity;
  let anyFailed = false;

  try {
    const now = Date.now();
    for (const item of items) {
      if (!getNetworkSnapshot().connected || activeUid !== uid || !cloudAuthorized) {
        break;
      }

      if (!ignoreBackoffWindow && item.nextRetryAt > now) {
        earliestNextRetry = Math.min(earliestNextRetry, item.nextRetryAt);
        continue;
      }

      try {
        await executeQueueItemOnCloud(uid, item);
        await markSyncQueueItemSynced(item.id);
      } catch {
        anyFailed = true;
        const nextAttempts = (item.attempts || 0) + 1;
        const backoffMs = computeExponentialBackoffMs(nextAttempts);
        const retryAt = Date.now() + backoffMs;
        earliestNextRetry = Math.min(earliestNextRetry, retryAt);
        await recordSyncQueueRetryFailure(item.id, nextAttempts, retryAt);
      }
    }

    if (!anyFailed) {
      hadRecentError = false;
      lastSyncedAt = new Date().toISOString();
    } else {
      hadRecentError = true;
    }
  } finally {
    isFlushing = false;
    await refreshPendingCache();

    if (cachedPendingItems.length > 0 && getNetworkSnapshot().connected && activeUid && cloudAuthorized) {
      const waitMs =
        Number.isFinite(earliestNextRetry) && earliestNextRetry > Date.now()
          ? Math.max(500, earliestNextRetry - Date.now())
          : 2000;
      scheduleRetry(waitMs);
    }
  }
}

/**
 * Initializes network listeners and hydrates pending queue count on app startup.
 */
export function startSyncEngine(): () => void {
  if (!networkUnsubscribed) {
    networkUnsubscribed = true;
    subscribeNetworkStatus((net) => {
      notifyListeners();
      if (net.connected) {
        // Immediately flush batch queue when connection returns!
        void flushSyncQueue(true);
      }
    });
  }

  void refreshPendingCache();

  return () => {
    if (flushTimer) clearTimeout(flushTimer);
    if (retryTimer) clearTimeout(retryTimer);
  };
}

/**
 * Updates the active authenticated cloud session context and triggers immediate batch sync if online.
 */
export function setSyncEngineAuthContext(uid: string | null, canSyncCloud: boolean): void {
  activeUid = uid;
  cloudAuthorized = Boolean(uid && canSyncCloud);
  if (!uid) {
    hadRecentError = false;
  }
  notifyListeners();

  if (uid && cloudAuthorized && getNetworkSnapshot().connected) {
    void flushSyncQueue(true);
  }
}

export function subscribeSyncEngineState(listener: SyncStateListener): () => void {
  listeners.add(listener);
  listener(buildSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncEngineSnapshot(): SyncEngineSnapshot {
  return buildSnapshot();
}

export function getPendingEntitySets(): PendingEntitySets {
  const sets: PendingEntitySets = {
    pendingProgressIds: new Set<string>(),
    pendingCustomCardIds: new Set<string>(),
    pendingDeletedCustomCardIds: new Set<string>(),
    pendingDeckIds: new Set<string>(),
    pendingDeletedDeckIds: new Set<string>(),
    hasPendingWorkspace: false,
  };

  for (const item of cachedPendingItems) {
    const p = item.payload;
    if (p.type === 'CARD_PROGRESS_UPSERT') {
      sets.pendingProgressIds.add(p.cardId);
    } else if (p.type === 'CUSTOM_CARD_UPSERT') {
      sets.pendingCustomCardIds.add(p.card.id);
    } else if (p.type === 'CUSTOM_CARD_DELETE') {
      sets.pendingDeletedCustomCardIds.add(p.cardId);
    } else if (p.type === 'DECK_UPSERT') {
      sets.pendingDeckIds.add(p.deck.id);
    } else if (p.type === 'DECK_DELETE') {
      sets.pendingDeletedDeckIds.add(p.deckId);
    } else if (p.type === 'WORKSPACE_SETTINGS_UPDATE') {
      sets.hasPendingWorkspace = true;
    }
  }

  return sets;
}

/**
 * Optimistic Local-First Write API (<10ms local write + queued background cloud sync)
 */
export async function recordCardMasteryOptimistic(params: {
  cardId: string;
  masteryLevel: CardStatus;
  roundMarked?: number;
}): Promise<CardProgressEntry> {
  const nowIso = new Date().toISOString();
  const entry: CardProgressEntry = {
    cardId: params.cardId,
    masteryLevel: params.masteryLevel,
    roundMarked: params.roundMarked ?? 1,
    updatedAt: nowIso,
  };

  await saveCardProgressLocal(entry);

  await upsertSyncQueueEvent({
    dedupeKey: `progress:${params.cardId}`,
    action: 'CARD_PROGRESS_UPSERT',
    payload: {
      type: 'CARD_PROGRESS_UPSERT',
      cardId: params.cardId,
      masteryLevel: params.masteryLevel,
      roundMarked: entry.roundMarked,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(180);
  }
  return entry;
}

export async function recordCustomCardUpsertOptimistic(card: Flashcard): Promise<Flashcard> {
  const stamped: Flashcard = {
    ...card,
    origin: 'custom',
    updatedAt: Date.now(),
  };

  await saveCustomCardLocal(stamped);

  await upsertSyncQueueEvent({
    dedupeKey: `custom:${stamped.id}`,
    action: 'CUSTOM_CARD_UPSERT',
    payload: {
      type: 'CUSTOM_CARD_UPSERT',
      card: stamped,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(180);
  }
  return stamped;
}

export async function recordCustomCardDeleteOptimistic(cardId: string): Promise<void> {
  await deleteCustomCardLocal(cardId);

  await upsertSyncQueueEvent({
    dedupeKey: `custom:${cardId}`,
    action: 'CUSTOM_CARD_DELETE',
    payload: {
      type: 'CUSTOM_CARD_DELETE',
      cardId,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(180);
  }
}

export async function recordDeckUpsertOptimistic(deck: UserDeck): Promise<UserDeck> {
  const stamped: UserDeck = {
    ...deck,
    updatedAt: Date.now(),
  };

  await saveDeckLocal(stamped);

  await upsertSyncQueueEvent({
    dedupeKey: `deck:${stamped.id}`,
    action: 'DECK_UPSERT',
    payload: {
      type: 'DECK_UPSERT',
      deck: stamped,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(180);
  }
  return stamped;
}

export async function recordDeckDeleteOptimistic(deckId: string): Promise<void> {
  await deleteDeckLocal(deckId);

  await upsertSyncQueueEvent({
    dedupeKey: `deck:${deckId}`,
    action: 'DECK_DELETE',
    payload: {
      type: 'DECK_DELETE',
      deckId,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(180);
  }
}

export async function recordWorkspaceUpdateOptimistic(
  workspace: LocalWorkspaceConfig
): Promise<void> {
  const stamped: LocalWorkspaceConfig = {
    ...workspace,
    updatedAt: new Date().toISOString(),
  };

  await saveWorkspaceConfigLocal(stamped);

  await upsertSyncQueueEvent({
    dedupeKey: 'workspace:root',
    action: 'WORKSPACE_SETTINGS_UPDATE',
    payload: {
      type: 'WORKSPACE_SETTINGS_UPDATE',
      studyScope: stamped.studyScope,
      selectedCardIds: stamped.selectedCardIds,
      connectedDeckIds: stamped.connectedDeckIds,
      activeRound: stamped.activeRound,
      preferredAccent: stamped.preferredAccent,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(450);
  }
}

export async function recordQuizScoreOptimistic(params: {
  score: number;
  totalAnswered: number;
  cardId?: string;
  isCorrect?: boolean;
}): Promise<void> {
  const updatedAt = new Date().toISOString();
  await saveQuizSessionLocal({
    score: params.score,
    totalAnswered: params.totalAnswered,
    updatedAt,
  });

  if (activeUid && cloudAuthorized) {
    await upsertSyncQueueEvent({
      dedupeKey: 'quiz:session',
      action: 'QUIZ_SCORE_UPDATE',
      payload: {
        type: 'QUIZ_SCORE_UPDATE',
        score: params.score,
        totalAnswered: params.totalAnswered,
        cardId: params.cardId,
        isCorrect: params.isCorrect,
      },
      ownerUid: activeUid,
    });
    await refreshPendingCache();
    if (getNetworkSnapshot().connected) {
      scheduleFlush(350);
    }
  }
}

export async function recordLeaderboardScoreOptimistic(
  payload: UpsertLeaderboardPayload
): Promise<void> {
  if (payload.score <= 0) return;

  await upsertSyncQueueEvent({
    dedupeKey: `leaderboard:${payload.monthKey}`,
    action: 'LEADERBOARD_SCORE_UPSERT',
    payload: {
      type: 'LEADERBOARD_SCORE_UPSERT',
      ...payload,
    },
    ownerUid: activeUid,
  });

  await refreshPendingCache();
  if (activeUid && cloudAuthorized && getNetworkSnapshot().connected) {
    scheduleFlush(600);
  }
}

export async function recordLinguisticCacheOptimistic(params: {
  cacheId: string;
  canonicalKey: string;
  result: LinguisticEngineResult;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const cleanResult: LinguisticEngineResult = { ...params.result };
  delete cleanResult.cacheLayer;

  await putLinguisticCacheLocal({
    cacheKey: params.cacheId,
    canonicalKey: params.canonicalKey,
    mode: params.result.mode,
    result: cleanResult,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const payloadJson = JSON.stringify(cleanResult);
  if (activeUid && cloudAuthorized && payloadJson.length >= 20 && payloadJson.length <= 24000) {
    await upsertSyncQueueEvent({
      dedupeKey: `lcache:${params.cacheId}`,
      action: 'LINGUISTIC_CACHE_UPSERT',
      payload: {
        type: 'LINGUISTIC_CACHE_UPSERT',
        cacheId: params.cacheId,
        mode: params.result.mode,
        canonicalKey: params.canonicalKey,
        payloadJson,
      },
      ownerUid: activeUid,
    });
    await refreshPendingCache();
    if (getNetworkSnapshot().connected) {
      scheduleFlush(350);
    }
  }
}

export async function recordCuratedGlobalCardOptimistic(card: Flashcard): Promise<Flashcard> {
  const stamped: Flashcard = {
    ...card,
    origin: 'global',
    published: true,
    archived: false,
    updatedAt: Date.now(),
  };

  await saveDiscoveredSchoolCardLocal(stamped);

  if (activeUid && cloudAuthorized) {
    await upsertSyncQueueEvent({
      dedupeKey: `gcatalog:${stamped.id}`,
      action: 'CURATED_GLOBAL_CARD_UPSERT',
      payload: {
        type: 'CURATED_GLOBAL_CARD_UPSERT',
        card: stamped,
      },
      ownerUid: activeUid,
    });
    await refreshPendingCache();
    if (getNetworkSnapshot().connected) {
      scheduleFlush(350);
    }
  }

  return stamped;
}
