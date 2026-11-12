import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthAccountModal } from './components/AuthAccountModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CoverView } from './components/CoverView';
import { FilterToolbar } from './components/FilterToolbar';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { StudyReminderModal } from './components/StudyReminderModal';
import { StudyView } from './components/StudyView';
import { UpdateAvailableBanner } from './components/UpdateAvailableBanner';
import {
  DEFAULT_STARTER_STUDY_IDS,
  INITIAL_CARDS,
  MAX_STUDY_CARDS,
  MIN_STUDY_CARDS,
} from './data/seedData';
import {
  canSyncUserWithCloud,
  deleteGlobalCardFromCloud,
  grantCoAdminByUid,
  revokeCoAdminByUid,
  subscribeGlobalCards,
  subscribeGrantedAdmins,
  subscribeUserCloudData,
  upsertGlobalCardAsAdmin,
  type User,
} from './services/firebase';
import {
  applyOneClickAppUpdate,
  checkForAppReleaseUpdate,
  dismissReleaseUpdateTag,
  formatAuthErrorPtBr,
  isAuthUserCancelled,
  loadStudyReminderConfig,
  mergeCustomCardsLww,
  mergeProgressMapsLossless,
  mergeUserDecksLww,
  registerHybridLifecycleListeners,
  signInWithGoogleHybrid,
  signOutHybrid,
  startWebStudyReminderWatcher,
  subscribeHybridAuthState,
  syncAndMergeVisitorIntoCloud,
  triggerError,
  triggerFlip,
  triggerSuccess,
  triggerTap,
  type AppUpdateInfo,
} from './services/platform';
import {
  clearAllUserOfflineDataOnAccountDelete,
  flushSyncQueue,
  getPendingEntitySets,
  getSyncEngineSnapshot,
  hydrateOfflineDatabase,
  loadLegacyFallbackSync,
  recordCardMasteryOptimistic,
  recordCustomCardDeleteOptimistic,
  recordCustomCardUpsertOptimistic,
  recordDeckDeleteOptimistic,
  recordDeckUpsertOptimistic,
  recordQuizScoreOptimistic,
  recordWorkspaceUpdateOptimistic,
  replaceCustomCardsLocal,
  replaceDecksLocal,
  replaceProgressMapLocal,
  saveGlobalCardsCacheLocal,
  saveStudyStatsLocal,
  saveWorkspaceConfigLocal,
  setSyncEngineAuthContext,
  startSyncEngine,
  subscribeSyncEngineState,
} from './services/sync';
import type {
  AdminRecord,
  AppTab,
  CardProgressEntry,
  DeckColorTag,
  Flashcard,
  ListSelectionFilter,
  ListViewMode,
  QuizOption,
  QuizQuestion,
  StatusFilter,
  StudyScope,
  SubtopicKey,
  SyncStatus,
  ThemeMode,
  TopicFolder,
  UserDeck,
} from './types/flashcard';
import {
  shouldOpenDownloadFromSearch,
  shouldSkipCoverFromSearch,
} from './utils/coverHelpers';
import {
  computeFolderAndSubtopicCounts,
  filterListCards,
  filterStudyCards,
  generateQuizQuestion,
  hydrateCard,
  mergeCatalogAndUserCards,
  resolveConnectedDecksCards,
} from './utils/deckHelpers';
import {
  compareUsAndUkSpeech,
  toggleSpeakEnglishText,
  toggleSpeechSpeed,
} from './utils/speech';
import {
  recordCardReviewInStats,
  recordStudyTimeInStats,
  setDailyGoalInStats,
  type UserStudyStats,
} from './utils/studyMetrics';

// Lazy-loaded heavy screens & modals for 60fps instant startup
const LazyDecksView = lazy(() =>
  import('./components/DecksView').then((m) => ({ default: m.DecksView }))
);
const LazyQuizView = lazy(() =>
  import('./components/QuizView').then((m) => ({ default: m.QuizView }))
);
const LazyListView = lazy(() =>
  import('./components/ListView').then((m) => ({ default: m.ListView }))
);
const LazyCardModal = lazy(() =>
  import('./components/CardModal').then((m) => ({ default: m.CardModal }))
);
const LazyAdminModal = lazy(() =>
  import('./components/AdminModal').then((m) => ({ default: m.AdminModal }))
);
const LazyPhoneticGrammarModal = lazy(() =>
  import('./components/PhoneticGrammarModal').then((m) => ({
    default: m.PhoneticGrammarModal,
  }))
);
const LazyMonthlyRankingModal = lazy(() =>
  import('./components/MonthlyRankingModal').then((m) => ({
    default: m.MonthlyRankingModal,
  }))
);
const LazyDownloadAppModal = lazy(() =>
  import('./components/DownloadAppModal').then((m) => ({
    default: m.DownloadAppModal,
  }))
);

const LEGACY_MARIANA_PHOTO_KEY = 'ewm_v5_mariana_photo';

type CardModalContext =
  | { mode: 'custom' }
  | { mode: 'custom_for_deck'; deckId: string }
  | { mode: 'global_admin' };

function ViewSuspenseFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white/80 dark:bg-[#212421]/80 p-8 sm:p-12 text-center animate-pulse"
    >
      <div className="h-4 w-44 mx-auto rounded-lg bg-[#E4E0D8] dark:bg-[#2F352F] mb-3" />
      <div className="h-3 w-64 mx-auto rounded-lg bg-[#ECE9E1] dark:bg-[#282D28]" />
    </div>
  );
}

export default function App() {
  const initialLegacy = useMemo(() => loadLegacyFallbackSync(), []);
  const initialSyncSnap = useMemo(() => getSyncEngineSnapshot(), []);

  // Auth & Hybrid Sync Engine State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(initialSyncSnap.status);
  const [syncLabel, setSyncLabel] = useState<string>(initialSyncSnap.label);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(initialSyncSnap.pendingCount);
  const [isOnline, setIsOnline] = useState<boolean>(initialSyncSnap.isOnline);

  // Offline-First Local + Cloud Data Sources
  const [globalCards, setGlobalCards] = useState<Flashcard[]>([]);
  const [customCards, setCustomCards] = useState<Flashcard[]>(initialLegacy.customCards);
  const [progressMap, setProgressMap] = useState<Record<string, CardProgressEntry>>(
    initialLegacy.progressMap
  );
  const [userDecks, setUserDecks] = useState<UserDeck[]>(initialLegacy.decks);
  const [connectedDeckIds, setConnectedDeckIds] = useState<string[]>(
    initialLegacy.workspace.connectedDeckIds
  );
  const [grantedAdmins, setGrantedAdmins] = useState<AdminRecord[]>([]);

  const [deletedIds, setDeletedIds] = useState<string[]>(initialLegacy.workspace.deletedIds);
  const [selectedStudyIds, setSelectedStudyIds] = useState<Set<string>>(
    () => new Set(initialLegacy.workspace.selectedCardIds)
  );
  const [theme, setTheme] = useState<ThemeMode>(initialLegacy.workspace.theme);
  const [shuffleOrderIds, setShuffleOrderIds] = useState<string[] | null>(null);
  const [showCover, setShowCover] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !shouldSkipCoverFromSearch(window.location.search);
  });
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('study');
  const [studyScope, setStudyScope] = useState<StudyScope>(initialLegacy.workspace.studyScope);

  const [selectedCategory, setSelectedCategory] = useState<'all' | TopicFolder>('all');
  const [selectedSubtopic, setSelectedSubtopic] = useState<'all' | SubtopicKey>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [listSelectionFilter, setListSelectionFilter] = useState<ListSelectionFilter>('all');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('grid');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Modals & Notifications
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardModalCtx, setCardModalCtx] = useState<CardModalContext>({ mode: 'custom' });
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [phoneticModalOpen, setPhoneticModalOpen] = useState(false);
  const [rankingModalOpen, setRankingModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return shouldOpenDownloadFromSearch(window.location.search);
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<Flashcard | null>(null);
  const [pendingDeleteDeck, setPendingDeleteDeck] = useState<UserDeck | null>(null);

  const [userStats, setUserStats] = useState<UserStudyStats>(initialLegacy.studyStats);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const cloudReadyForUidRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  // Quiz state
  const [quizQuestion, setQuizQuestion] = useState<QuizQuestion | null>(() =>
    generateQuizQuestion(INITIAL_CARDS.map(hydrateCard), 'all', 'all')
  );
  const [quizSelectedOptionId, setQuizSelectedOptionId] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);

  // 0. Boot Offline-First Engine (IndexedDB + Capacitor Preferences + Network + Reminders)
  useEffect(() => {
    let mounted = true;
    const stopEngine = startSyncEngine();
    const unsubSync = subscribeSyncEngineState((snap) => {
      if (!mounted) return;
      setSyncStatus(snap.status);
      setSyncLabel(snap.label);
      setPendingSyncCount(snap.pendingCount);
      setIsOnline(snap.isOnline);
    });

    const stopReminderWatcher = startWebStudyReminderWatcher();
    void loadStudyReminderConfig().then((cfg) => {
      if (mounted) setReminderEnabled(cfg.enabled);
    });

    const updateTimer = window.setTimeout(() => {
      void checkForAppReleaseUpdate().then((info) => {
        if (mounted && info) setAvailableUpdate(info);
      });
    }, 1800);

    void hydrateOfflineDatabase().then((hydrated) => {
      if (!mounted) return;
      if (hydrated.globalCards.length > 0) {
        setGlobalCards((prev) => (prev.length > 0 ? prev : hydrated.globalCards));
      }
      if (hydrated.customCards.length > 0) {
        setCustomCards((prev) =>
          mergeCustomCardsLww(hydrated.customCards, prev)
        );
      }
      if (hydrated.decks.length > 0) {
        setUserDecks((prev) => mergeUserDecksLww(hydrated.decks, prev));
      }
      if (Object.keys(hydrated.progressMap).length > 0) {
        setProgressMap((prev) => mergeProgressMapsLossless(hydrated.progressMap, prev));
      }

      setStudyScope(hydrated.workspace.studyScope);
      if (hydrated.workspace.selectedCardIds.length > 0) {
        setSelectedStudyIds(new Set(hydrated.workspace.selectedCardIds));
      }
      setConnectedDeckIds(hydrated.workspace.connectedDeckIds);
      setDeletedIds(hydrated.workspace.deletedIds);
      setTheme(hydrated.workspace.theme);
      setUserStats(hydrated.studyStats);

      if (hydrated.quizSession.totalAnswered > 0) {
        setQuizScore(hydrated.quizSession.score);
        setQuizTotal(hydrated.quizSession.totalAnswered);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(updateTimer);
      unsubSync();
      stopReminderWatcher();
      stopEngine();
    };
  }, []);

  // Native Android Hardware Back Button + Foreground Resume Queue Flush
  const navStateRef = useRef({
    authModalOpen,
    reminderModalOpen,
    downloadModalOpen,
    cardModalOpen,
    adminModalOpen,
    phoneticModalOpen,
    rankingModalOpen,
    pendingDeleteCard,
    pendingDeleteDeck,
    focusMode,
    showCover,
    activeTab,
  });
  navStateRef.current = {
    authModalOpen,
    reminderModalOpen,
    downloadModalOpen,
    cardModalOpen,
    adminModalOpen,
    phoneticModalOpen,
    rankingModalOpen,
    pendingDeleteCard,
    pendingDeleteDeck,
    focusMode,
    showCover,
    activeTab,
  };

  useEffect(() => {
    return registerHybridLifecycleListeners({
      onBackButton: () => {
        const s = navStateRef.current;
        if (s.pendingDeleteCard) {
          setPendingDeleteCard(null);
          return true;
        }
        if (s.pendingDeleteDeck) {
          setPendingDeleteDeck(null);
          return true;
        }
        if (s.downloadModalOpen) {
          setDownloadModalOpen(false);
          return true;
        }
        if (s.authModalOpen) {
          setAuthModalOpen(false);
          return true;
        }
        if (s.reminderModalOpen) {
          setReminderModalOpen(false);
          return true;
        }
        if (s.cardModalOpen) {
          setCardModalOpen(false);
          setEditingCard(null);
          return true;
        }
        if (s.adminModalOpen) {
          setAdminModalOpen(false);
          return true;
        }
        if (s.phoneticModalOpen) {
          setPhoneticModalOpen(false);
          return true;
        }
        if (s.rankingModalOpen) {
          setRankingModalOpen(false);
          return true;
        }
        if (s.focusMode) {
          setFocusMode(false);
          return true;
        }
        if (!s.showCover && s.activeTab !== 'study') {
          setActiveTab('study');
          return true;
        }
        if (!s.showCover) {
          setShowCover(true);
          return true;
        }
        return false;
      },
      onAppForeground: () => {
        void flushSyncQueue(true);
        void checkForAppReleaseUpdate().then((info) => {
          if (info) setAvailableUpdate(info);
        });
      },
    });
  }, []);

  const handleUpdateGoal = useCallback(
    (newGoal: number) => {
      setUserStats((prev) => {
        const next = setDailyGoalInStats(newGoal, prev);
        void saveStudyStatsLocal(next);
        return next;
      });
      showToast(`Meta diária atualizada para ${newGoal} cards.`);
    },
    [showToast]
  );

  // Track active study minutes in the current month and persist offline
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!showCover && (activeTab === 'study' || activeTab === 'quiz')) {
        setUserStats((prev) => {
          const next = recordStudyTimeInStats(15, prev);
          void saveStudyStatsLocal(next);
          return next;
        });
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [showCover, activeTab]);

  // Merge catalog (172 seed + live Admin broadcasts + student custom cards + mastery progress)
  const cards = useMemo(() => {
    const base = mergeCatalogAndUserCards({
      seedCards: INITIAL_CARDS,
      globalCards,
      customCards,
      progressMap,
      localDeletedIds: new Set(deletedIds),
    });
    if (!shuffleOrderIds || shuffleOrderIds.length === 0) return base;
    const orderIndex = new Map(shuffleOrderIds.map((id, i) => [id, i]));
    return [...base].sort(
      (a, b) => (orderIndex.get(a.id) ?? 99999) - (orderIndex.get(b.id) ?? 99999)
    );
  }, [globalCards, customCards, progressMap, deletedIds, shuffleOrderIds]);

  const connectedCards = useMemo(
    () =>
      resolveConnectedDecksCards({
        allCards: cards,
        connectedDeckIds,
        userDecks,
      }),
    [cards, connectedDeckIds, userDecks]
  );

  const connectedCardIds = useMemo(
    () => new Set(connectedCards.map((c) => c.id)),
    [connectedCards]
  );

  const quizPool = useMemo(
    () => (studyScope === 'decks' && connectedCards.length >= 4 ? connectedCards : cards),
    [studyScope, connectedCards, cards]
  );

  // Sync dark class, color-scheme, and iOS/Android status bar theme-color to <html> & <head>
  useEffect(() => {
    const root = document.documentElement;
    const activeThemeColor = theme === 'dark' ? '#181A18' : '#F6F4EF';
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = theme;

    const themeMetaTags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    themeMetaTags.forEach((tag) => {
      tag.setAttribute('content', activeThemeColor);
    });
  }, [theme]);

  // Purge any previously cached custom portrait so Cover portrait remains strictly immutable
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_MARIANA_PHOTO_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Keep legacy visitor localStorage mirror in sync for instant synchronous cold start
  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem('ewm_v5_visitor_custom_cards', JSON.stringify(customCards));
      localStorage.setItem('ewm_v5_visitor_progress', JSON.stringify(progressMap));
      localStorage.setItem('ewm_v5_visitor_decks', JSON.stringify(userDecks));
    } catch {
      // ignore
    }
  }, [currentUser, customCards, progressMap, userDecks]);

  // 1. Hybrid Auth State Listener (Web + Capacitor Native)
  useEffect(() => {
    const unsubAuth = subscribeHybridAuthState((user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (!user) {
        cloudReadyForUidRef.current = null;
        setIsAdmin(false);
        setGrantedAdmins([]);
        setSyncEngineAuthContext(null, false);
      } else {
        setSyncEngineAuthContext(user.uid, canSyncUserWithCloud(user));
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. Subscribe to Global Official Cards once Auth state is initialized & cache in IndexedDB
  useEffect(() => {
    if (!isAuthReady) return;
    let unsubGlobal: (() => void) | null = null;
    try {
      unsubGlobal = subscribeGlobalCards((items) => {
        setGlobalCards(items);
        void saveGlobalCardsCacheLocal(items);
      });
    } catch {
      // handled inside subscribeGlobalCards
    }
    return () => {
      if (unsubGlobal) unsubGlobal();
    };
  }, [isAuthReady, isOnline]);

  // 3. Initialize User Cloud Workspace + Lossless Visitor Merge + Real-time LWW Listeners
  const latestLocalSnapshotRef = useRef({
    studyScope,
    selectedCardIds: Array.from(selectedStudyIds),
    connectedDeckIds,
    deletedIds,
    theme,
    customCards,
    decks: userDecks,
    progressMap,
  });
  latestLocalSnapshotRef.current = {
    studyScope,
    selectedCardIds: Array.from(selectedStudyIds),
    connectedDeckIds,
    deletedIds,
    theme,
    customCards,
    decks: userDecks,
    progressMap,
  };

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const canSync = canSyncUserWithCloud(currentUser);
    setSyncEngineAuthContext(currentUser.uid, canSync);

    if (!canSync) {
      cloudReadyForUidRef.current = null;
      setIsAdmin(false);
      setGrantedAdmins([]);
      return;
    }

    let cancelled = false;
    let unsubUser: (() => void) | null = null;
    let unsubAdmins: (() => void) | null = null;

    const bootCloudSession = async () => {
      try {
        const snap = latestLocalSnapshotRef.current;
        const result = await syncAndMergeVisitorIntoCloud(currentUser, {
          studyScope: snap.studyScope,
          selectedCardIds: snap.selectedCardIds,
          connectedDeckIds: snap.connectedDeckIds,
          activeRound: 1,
          customCards: snap.customCards,
          decks: snap.decks,
          progressEntries: Object.values(snap.progressMap),
        });

        if (cancelled) return;

        setIsAdmin(result.isAdmin);

        if (!result.createdNew && result.workspace) {
          const pending = getPendingEntitySets();
          if (!pending.hasPendingWorkspace) {
            setStudyScope(result.workspace.studyScope);
            if (result.workspace.selectedCardIds.length > 0) {
              setSelectedStudyIds(new Set(result.workspace.selectedCardIds));
            }
            setConnectedDeckIds(result.workspace.connectedDeckIds);
            void saveWorkspaceConfigLocal({
              studyScope: result.workspace.studyScope,
              selectedCardIds:
                result.workspace.selectedCardIds.length > 0
                  ? result.workspace.selectedCardIds
                  : snap.selectedCardIds,
              connectedDeckIds: result.workspace.connectedDeckIds,
              deletedIds: snap.deletedIds,
              activeRound: result.workspace.activeRound,
              theme: snap.theme,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        cloudReadyForUidRef.current = currentUser.uid;
        void flushSyncQueue(true);

        unsubUser = subscribeUserCloudData(currentUser.uid, {
          onWorkspace: (ws) => {
            if (getPendingEntitySets().hasPendingWorkspace) return;
            setStudyScope(ws.studyScope);
            if (ws.selectedCardIds.length > 0) {
              setSelectedStudyIds(new Set(ws.selectedCardIds));
            }
            setConnectedDeckIds(ws.connectedDeckIds);
            const cur = latestLocalSnapshotRef.current;
            void saveWorkspaceConfigLocal({
              studyScope: ws.studyScope,
              selectedCardIds:
                ws.selectedCardIds.length > 0 ? ws.selectedCardIds : cur.selectedCardIds,
              connectedDeckIds: ws.connectedDeckIds,
              deletedIds: cur.deletedIds,
              activeRound: ws.activeRound,
              theme: cur.theme,
              updatedAt: new Date().toISOString(),
            });
          },
          onCustomCards: (cloudCustom) => {
            const pending = getPendingEntitySets();
            setCustomCards((prev) => {
              const merged = mergeCustomCardsLww(
                prev,
                cloudCustom,
                pending.pendingCustomCardIds,
                pending.pendingDeletedCustomCardIds
              );
              void replaceCustomCardsLocal(merged);
              return merged;
            });
          },
          onDecks: (cloudDecks) => {
            const pending = getPendingEntitySets();
            setUserDecks((prev) => {
              const merged = mergeUserDecksLww(
                prev,
                cloudDecks,
                pending.pendingDeckIds,
                pending.pendingDeletedDeckIds
              );
              void replaceDecksLocal(merged);
              return merged;
            });
          },
          onProgressMap: (cloudProgress) => {
            const pending = getPendingEntitySets();
            setProgressMap((prev) => {
              const merged = mergeProgressMapsLossless(
                prev,
                cloudProgress,
                pending.pendingProgressIds
              );
              void replaceProgressMapLocal(merged);
              return merged;
            });
          },
        });

        if (result.isAdmin) {
          unsubAdmins = subscribeGrantedAdmins(currentUser.uid, (list) => {
            setGrantedAdmins(list);
          });
        }
      } catch {
        // Offline or transient network drop: local IndexedDB + SyncQueue remain active
        // and this effect automatically re-runs when `isOnline` transitions back to `true`.
      }
    };

    void bootCloudSession();

    return () => {
      cancelled = true;
      if (unsubUser) unsubUser();
      if (unsubAdmins) unsubAdmins();
    };
  }, [isAuthReady, currentUser, currentUser?.emailVerified, isOnline]);

  // Optimistic Workspace Local + Queue Persistence (<10ms)
  const persistWorkspaceOptimistic = useCallback(
    (nextPatch: {
      studyScope?: StudyScope;
      selectedCardIds?: string[];
      connectedDeckIds?: string[];
      deletedIds?: string[];
      theme?: ThemeMode;
    }) => {
      const cur = latestLocalSnapshotRef.current;
      void recordWorkspaceUpdateOptimistic({
        studyScope: nextPatch.studyScope ?? cur.studyScope,
        selectedCardIds: nextPatch.selectedCardIds ?? cur.selectedCardIds,
        connectedDeckIds: nextPatch.connectedDeckIds ?? cur.connectedDeckIds,
        deletedIds: nextPatch.deletedIds ?? cur.deletedIds,
        activeRound: 1,
        theme: nextPatch.theme ?? cur.theme,
        updatedAt: new Date().toISOString(),
      });
    },
    []
  );

  const handleToggleTheme = useCallback(() => {
    void triggerTap();
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      const cur = latestLocalSnapshotRef.current;
      void saveWorkspaceConfigLocal({
        studyScope: cur.studyScope,
        selectedCardIds: cur.selectedCardIds,
        connectedDeckIds: cur.connectedDeckIds,
        deletedIds: cur.deletedIds,
        activeRound: 1,
        theme: next,
        updatedAt: new Date().toISOString(),
      });
      return next;
    });
  }, []);

  const { folderCounts, subtopicCounts } = useMemo(() => {
    let scopedCards = cards;
    if (activeTab === 'study') {
      if (studyScope === 'selected') {
        scopedCards = cards.filter((c) => selectedStudyIds.has(c.id));
      } else if (studyScope === 'decks') {
        scopedCards = cards.filter((c) => connectedCardIds.has(c.id));
      }
    }
    return computeFolderAndSubtopicCounts(scopedCards, selectedCategory, selectedSubtopic);
  }, [
    cards,
    activeTab,
    studyScope,
    selectedStudyIds,
    connectedCardIds,
    selectedCategory,
    selectedSubtopic,
  ]);

  const filteredStudyCards = useMemo(
    () =>
      filterStudyCards({
        cards,
        selectedStudyIds,
        connectedCardIds,
        studyScope,
        selectedCategory,
        selectedSubtopic,
        selectedStatus,
      }),
    [
      cards,
      selectedStudyIds,
      connectedCardIds,
      studyScope,
      selectedCategory,
      selectedSubtopic,
      selectedStatus,
    ]
  );

  const filteredListCards = useMemo(
    () =>
      filterListCards({
        cards,
        selectedStudyIds,
        selectedCategory,
        selectedSubtopic,
        selectedStatus,
        listSelectionFilter,
        searchQuery,
      }),
    [
      cards,
      selectedStudyIds,
      selectedCategory,
      selectedSubtopic,
      selectedStatus,
      listSelectionFilter,
      searchQuery,
    ]
  );

  // Clamp index when filtered cards change
  useEffect(() => {
    if (currentIndex >= filteredStudyCards.length && filteredStudyCards.length > 0) {
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [filteredStudyCards.length, currentIndex]);

  const handleGoogleSignInAndEnter = useCallback(async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const user = await signInWithGoogleHybrid();
      void triggerSuccess();
      setShowCover(false);
      showToast(
        `Bem-vindo(a), ${user.displayName?.split(' ')[0] || 'aluno'}! Progresso mesclado com a nuvem.`
      );
    } catch (err) {
      if (!isAuthUserCancelled(err)) {
        showToast(formatAuthErrorPtBr(err));
      }
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn, showToast]);

  const handleSignOut = useCallback(async () => {
    await signOutHybrid();
    showToast('Sessão encerrada. Você está no modo visitante offline.');
  }, [showToast]);

  const handleAccountDeletedReset = useCallback(async (deletedUid: string) => {
    await clearAllUserOfflineDataOnAccountDelete(deletedUid);
    setCustomCards([]);
    setProgressMap({});
    setUserDecks([]);
    setConnectedDeckIds([]);
    setSelectedStudyIds(new Set(DEFAULT_STARTER_STUDY_IDS));
    setStudyScope('selected');
    setQuizScore(0);
    setQuizTotal(0);
    setIsAdmin(false);
    setGrantedAdmins([]);
    cloudReadyForUidRef.current = null;
  }, []);

  const handleToggleFlip = useCallback(() => {
    void triggerFlip();
    setIsFlipped((v) => !v);
  }, []);

  const handleNextCard = useCallback(() => {
    if (filteredStudyCards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredStudyCards.length);
  }, [filteredStudyCards.length]);

  const handlePrevCard = useCallback(() => {
    if (filteredStudyCards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredStudyCards.length) % filteredStudyCards.length);
  }, [filteredStudyCards.length]);

  const handleMarkStatus = useCallback(
    (newStatus: 'mastered' | 'review') => {
      if (filteredStudyCards.length === 0) return;
      const safeIdx = Math.min(currentIndex, filteredStudyCards.length - 1);
      const current = filteredStudyCards[safeIdx];
      if (!current) return;

      void (newStatus === 'mastered' ? triggerSuccess() : triggerFlip());

      const nowIso = new Date().toISOString();
      const entry: CardProgressEntry = {
        cardId: current.id,
        masteryLevel: newStatus,
        roundMarked: 1,
        updatedAt: nowIso,
      };

      // Instant <10ms optimistic UI + IndexedDB + SyncQueue
      setProgressMap((prev) => ({
        ...prev,
        [current.id]: entry,
      }));
      void recordCardMasteryOptimistic({
        cardId: current.id,
        masteryLevel: newStatus,
        roundMarked: 1,
      });

      setUserStats((prev) => {
        const next = recordCardReviewInStats(current.id, prev);
        void saveStudyStatsLocal(next);
        return next;
      });

      showToast(
        newStatus === 'mastered' ? 'Marcado como dominado.' : 'Marcado para revisar depois.'
      );
      setIsFlipped(false);
      setCurrentIndex((prev) => (prev + 1 < filteredStudyCards.length ? prev + 1 : 0));
    },
    [filteredStudyCards, currentIndex, showToast]
  );

  // Keyboard shortcuts for Desktop / Hardware Keyboard Study Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (e.key === 'Escape') {
        setCardModalOpen(false);
        setAdminModalOpen(false);
        setPhoneticModalOpen(false);
        setRankingModalOpen(false);
        setReminderModalOpen(false);
        setAuthModalOpen(false);
        setPendingDeleteCard(null);
        setPendingDeleteDeck(null);
        if (focusMode) setFocusMode(false);
        return;
      }

      if (
        isInput ||
        showCover ||
        cardModalOpen ||
        adminModalOpen ||
        phoneticModalOpen ||
        rankingModalOpen ||
        reminderModalOpen ||
        authModalOpen ||
        pendingDeleteCard ||
        pendingDeleteDeck
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const lowerKey = e.key.toLowerCase();

      if (lowerKey === 'f' && activeTab === 'study') {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }

      if (activeTab !== 'study') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleFlip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === '1') {
        e.preventDefault();
        handleMarkStatus('review');
      } else if (e.key === '2') {
        e.preventDefault();
        handleMarkStatus('mastered');
      } else if (lowerKey === 'u' || lowerKey === 'b') {
        if (filteredStudyCards.length > 0) {
          e.preventDefault();
          const safeIdx = Math.min(currentIndex, filteredStudyCards.length - 1);
          const current = filteredStudyCards[safeIdx];
          if (current) {
            void toggleSpeakEnglishText(current.term, lowerKey === 'b' ? 'uk' : 'us');
          }
        }
      } else if (lowerKey === 'c') {
        if (filteredStudyCards.length > 0) {
          e.preventDefault();
          const safeIdx = Math.min(currentIndex, filteredStudyCards.length - 1);
          const current = filteredStudyCards[safeIdx];
          if (current) {
            void compareUsAndUkSpeech(current.term, current.term);
          }
        }
      } else if (lowerKey === 's') {
        e.preventDefault();
        const nextSpeed = toggleSpeechSpeed();
        showToast(
          nextSpeed === 'slow'
            ? 'Velocidade da pronúncia: Lenta (0.7x)'
            : 'Velocidade da pronúncia: Normal (1x)'
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    showCover,
    focusMode,
    cardModalOpen,
    adminModalOpen,
    phoneticModalOpen,
    rankingModalOpen,
    reminderModalOpen,
    authModalOpen,
    pendingDeleteCard,
    pendingDeleteDeck,
    filteredStudyCards,
    currentIndex,
    handleToggleFlip,
    handleNextCard,
    handlePrevCard,
    handleMarkStatus,
    showToast,
  ]);

  const handleShuffle = useCallback(() => {
    void triggerTap();
    const shuffled = [...cards].sort(() => Math.random() - 0.5).map((c) => c.id);
    setShuffleOrderIds(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    showToast('Ordem dos cards embaralhada.');
  }, [cards, showToast]);

  const handleChangeScope = useCallback(
    (scope: StudyScope) => {
      void triggerTap();
      setStudyScope(scope);
      setCurrentIndex(0);
      setIsFlipped(false);
      persistWorkspaceOptimistic({ studyScope: scope });
    },
    [persistWorkspaceOptimistic]
  );

  const handleToggleCardSelection = useCallback(
    (cardId: string) => {
      void triggerTap();
      setSelectedStudyIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
          showToast(`Card removido do Estudo Objetivo (${next.size}/${MAX_STUDY_CARDS}).`);
        } else {
          if (next.size >= MAX_STUDY_CARDS) {
            showToast(`Limite máximo de ${MAX_STUDY_CARDS} cards no Estudo Objetivo atingido.`);
            return prev;
          }
          next.add(cardId);
          if (next.size < MIN_STUDY_CARDS) {
            showToast(`Selecionado! Escolha ao menos ${MIN_STUDY_CARDS - next.size} mais.`);
          } else {
            showToast(`Selecionado (${next.size}/${MAX_STUDY_CARDS}).`);
          }
        }
        persistWorkspaceOptimistic({ selectedCardIds: Array.from(next) });
        return next;
      });
    },
    [persistWorkspaceOptimistic, showToast]
  );

  const handleQuickRandomSelection = useCallback(
    (qty: number) => {
      void triggerTap();
      const count = Math.max(MIN_STUDY_CARDS, Math.min(MAX_STUDY_CARDS, qty));
      const pool = [...cards].sort(() => Math.random() - 0.5);
      const chosenArr = pool.slice(0, Math.min(count, pool.length)).map((c) => c.id);
      setSelectedStudyIds(new Set(chosenArr));
      setStudyScope('selected');
      setCurrentIndex(0);
      setIsFlipped(false);
      persistWorkspaceOptimistic({ studyScope: 'selected', selectedCardIds: chosenArr });
      showToast(`${chosenArr.length} cards sorteados para sua sessão de estudo.`);
    },
    [cards, persistWorkspaceOptimistic, showToast]
  );

  const handleClearSelection = useCallback(() => {
    void triggerTap();
    setSelectedStudyIds(new Set());
    persistWorkspaceOptimistic({ selectedCardIds: [] });
    showToast('Seleção de estudo limpa.');
  }, [persistWorkspaceOptimistic, showToast]);

  /**
   * Connectable & Mixable Student Decks Handlers (Optimistic Offline-First)
   */
  const handleCreateOrUpdateDeckMeta = useCallback(
    (
      meta: { name: string; description: string; colorTag: DeckColorTag },
      existingDeck?: UserDeck
    ): string => {
      if (existingDeck) {
        const updated: UserDeck = { ...existingDeck, ...meta, updatedAt: Date.now() };
        setUserDecks((prev) => prev.map((d) => (d.id === existingDeck.id ? updated : d)));
        void recordDeckUpsertOptimistic(updated);
        void triggerSuccess();
        showToast(`Baralho "${meta.name}" atualizado.`);
        return existingDeck.id;
      }

      const newDeckId = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newDeck: UserDeck = {
        id: newDeckId,
        ownerId: currentUser?.uid || 'visitor',
        name: meta.name,
        description: meta.description,
        colorTag: meta.colorTag,
        cardIds: [],
        updatedAt: Date.now(),
      };
      setUserDecks((prev) => [newDeck, ...prev]);
      void recordDeckUpsertOptimistic(newDeck);

      setConnectedDeckIds((prev) => {
        if (prev.includes(newDeckId) || prev.length >= 12) return prev;
        const next = [...prev, newDeckId];
        persistWorkspaceOptimistic({ connectedDeckIds: next });
        return next;
      });

      void triggerSuccess();
      showToast(`Baralho "${meta.name}" criado! Agora escolha ou crie suas cartas.`);
      return newDeckId;
    },
    [currentUser, persistWorkspaceOptimistic, showToast]
  );

  const handleToggleCardInDeck = useCallback(
    (deckId: string, cardId: string) => {
      void triggerTap();
      setUserDecks((prev) => {
        const target = prev.find((d) => d.id === deckId);
        if (!target) return prev;
        const exists = target.cardIds.includes(cardId);
        if (!exists && target.cardIds.length >= 200) {
          showToast('Limite de 200 cartas por baralho atingido.');
          return prev;
        }
        const nextCardIds = exists
          ? target.cardIds.filter((id) => id !== cardId)
          : [...target.cardIds, cardId];
        const updatedDeck: UserDeck = { ...target, cardIds: nextCardIds, updatedAt: Date.now() };
        void recordDeckUpsertOptimistic(updatedDeck);
        return prev.map((d) => (d.id === deckId ? updatedDeck : d));
      });
    },
    [showToast]
  );

  const handleToggleConnectDeck = useCallback(
    (deckId: string) => {
      void triggerTap();
      setConnectedDeckIds((prev) => {
        const isConnected = prev.includes(deckId);
        let next: string[];
        if (isConnected) {
          next = prev.filter((id) => id !== deckId);
        } else {
          if (prev.length >= 12) {
            showToast('Você pode conectar até 12 baralhos simultaneamente.');
            return prev;
          }
          next = [...prev, deckId];
        }
        persistWorkspaceOptimistic({ connectedDeckIds: next });
        return next;
      });
    },
    [persistWorkspaceOptimistic, showToast]
  );

  const handleStudySingleDeck = useCallback(
    (deckId: string) => {
      void triggerTap();
      const next = [deckId];
      setConnectedDeckIds(next);
      setStudyScope('decks');
      setActiveTab('study');
      setCurrentIndex(0);
      setIsFlipped(false);
      persistWorkspaceOptimistic({ connectedDeckIds: next, studyScope: 'decks' });
    },
    [persistWorkspaceOptimistic]
  );

  const handleConfirmDeleteDeck = useCallback(() => {
    if (!pendingDeleteDeck) return;
    const target = pendingDeleteDeck;
    setUserDecks((prev) => prev.filter((d) => d.id !== target.id));
    void recordDeckDeleteOptimistic(target.id);
    setConnectedDeckIds((prev) => {
      const next = prev.filter((id) => id !== target.id);
      persistWorkspaceOptimistic({ connectedDeckIds: next });
      return next;
    });
    setPendingDeleteDeck(null);
    showToast(`Baralho "${target.name}" excluído.`);
  }, [pendingDeleteDeck, persistWorkspaceOptimistic, showToast]);

  /**
   * Unified Card Save Handler (Optimistic Local-First + Admin Broadcast Support)
   */
  const handleSaveCard = useCallback(
    (cardData: Omit<Flashcard, 'id' | 'status'>, existingId?: string) => {
      // Branch 1: Admin broadcasting or editing a Global Official Card
      if (cardModalCtx.mode === 'global_admin' && isAdmin && currentUser) {
        const targetId =
          existingId || `global_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        void upsertGlobalCardAsAdmin(currentUser.uid, { id: targetId, ...cardData }, false)
          .then(() => {
            void triggerSuccess();
            showToast(
              existingId
                ? `"${cardData.term}" atualizado para todos os usuários.`
                : `"${cardData.term}" disparado para todos os usuários!`
            );
          })
          .catch(() => {
            void triggerError();
            showToast('Sem conexão para publicar card global agora.');
          });
        setCardModalOpen(false);
        setEditingCard(null);
        return;
      }

      // Branch 2: Editing an existing card from Study/List
      if (existingId) {
        const isOfficial = !existingId.startsWith('custom_');
        if (isOfficial && isAdmin && currentUser) {
          void upsertGlobalCardAsAdmin(currentUser.uid, { id: existingId, ...cardData }, false)
            .then(() => {
              void triggerSuccess();
              showToast(`"${cardData.term}" atualizado no acervo global.`);
            })
            .catch(() => {
              void triggerError();
              showToast('Sem conexão para atualizar acervo global agora.');
            });
        } else if (!isOfficial) {
          const updatedCard: Flashcard = hydrateCard({
            id: existingId,
            status: progressMap[existingId]?.masteryLevel || 'unseen',
            origin: 'custom',
            updatedAt: Date.now(),
            ...cardData,
          });
          setCustomCards((prev) => prev.map((c) => (c.id === existingId ? updatedCard : c)));
          void recordCustomCardUpsertOptimistic(updatedCard);
          void triggerSuccess();
          showToast(`"${cardData.term}" atualizado.`);
        } else {
          // Student customizing an official card creates a personal copy in Minhas Criações
          const forkId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const forkedCard: Flashcard = hydrateCard({
            id: forkId,
            status: 'unseen',
            origin: 'custom',
            updatedAt: Date.now(),
            ...cardData,
          });
          setCustomCards((prev) => [forkedCard, ...prev]);
          void recordCustomCardUpsertOptimistic(forkedCard);
          void triggerSuccess();
          showToast(`Versão personalizada de "${cardData.term}" salva em Minhas Criações.`);
        }
        setCardModalOpen(false);
        setEditingCard(null);
        return;
      }

      // Branch 3: Creating a brand-new Student Custom Card (instant <10ms local write)
      const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newCard: Flashcard = hydrateCard({
        id: newId,
        status: 'unseen',
        origin: 'custom',
        updatedAt: Date.now(),
        ...cardData,
      });
      setCustomCards((prev) => [newCard, ...prev]);
      void recordCustomCardUpsertOptimistic(newCard);
      void triggerSuccess();

      if (cardModalCtx.mode === 'custom_for_deck') {
        const targetDeckId = cardModalCtx.deckId;
        setUserDecks((prev) => {
          const deck = prev.find((d) => d.id === targetDeckId);
          if (!deck || deck.cardIds.length >= 200) return prev;
          const updatedDeck: UserDeck = {
            ...deck,
            cardIds: [newId, ...deck.cardIds],
            updatedAt: Date.now(),
          };
          void recordDeckUpsertOptimistic(updatedDeck);
          return prev.map((d) => (d.id === targetDeckId ? updatedDeck : d));
        });
        showToast(`"${cardData.term}" criada e já adicionada ao seu baralho!`);
      } else {
        setSelectedStudyIds((prev) => {
          if (prev.size >= MAX_STUDY_CARDS) return prev;
          const next = new Set(prev);
          next.add(newId);
          persistWorkspaceOptimistic({ selectedCardIds: Array.from(next) });
          return next;
        });
        setCurrentIndex(0);
        setIsFlipped(false);
        showToast(`"${cardData.term}" criada em Minhas Criações!`);
      }

      setCardModalOpen(false);
      setEditingCard(null);
    },
    [cardModalCtx, currentUser, isAdmin, persistWorkspaceOptimistic, progressMap, showToast]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteCard) return;
    const target = pendingDeleteCard;

    if (target.origin === 'custom' || target.id.startsWith('custom_')) {
      setCustomCards((prev) => prev.filter((c) => c.id !== target.id));
      void recordCustomCardDeleteOptimistic(target.id);
    } else {
      setDeletedIds((prev) => {
        const next = prev.includes(target.id) ? prev : [...prev, target.id];
        persistWorkspaceOptimistic({ deletedIds: next });
        return next;
      });
    }

    setSelectedStudyIds((prev) => {
      const next = new Set(prev);
      if (next.delete(target.id)) {
        persistWorkspaceOptimistic({ selectedCardIds: Array.from(next) });
      }
      return next;
    });

    setPendingDeleteCard(null);
    showToast(`"${target.term}" removido.`);
  }, [pendingDeleteCard, persistWorkspaceOptimistic, showToast]);

  const handleSelectQuizOption = useCallback(
    (option: QuizOption) => {
      if (quizSelectedOptionId !== null) return;
      void (option.isCorrect ? triggerSuccess() : triggerError());

      const nextTotal = quizTotal + 1;
      const nextScore = option.isCorrect ? quizScore + 1 : quizScore;

      setQuizSelectedOptionId(option.id);
      setQuizTotal(nextTotal);
      setQuizScore(nextScore);

      void recordQuizScoreOptimistic({
        score: nextScore,
        totalAnswered: nextTotal,
        cardId: quizQuestion?.card.id,
        isCorrect: option.isCorrect,
      });

      if (quizQuestion?.card.id) {
        const reviewedId = quizQuestion.card.id;
        setUserStats((prev) => {
          const next = recordCardReviewInStats(reviewedId, prev);
          void saveStudyStatsLocal(next);
          return next;
        });
      }
    },
    [quizQuestion?.card.id, quizScore, quizSelectedOptionId, quizTotal]
  );

  const handleNextQuizQuestion = useCallback(() => {
    setQuizSelectedOptionId(null);
    setQuizQuestion(
      generateQuizQuestion(quizPool, selectedCategory, selectedSubtopic, quizQuestion?.card.id)
    );
  }, [quizPool, quizQuestion?.card.id, selectedCategory, selectedSubtopic]);

  const handleResetQuizScore = useCallback(() => {
    setQuizScore(0);
    setQuizTotal(0);
    void recordQuizScoreOptimistic({ score: 0, totalAnswered: 0 });
    setQuizSelectedOptionId(null);
    setQuizQuestion(
      generateQuizQuestion(quizPool, selectedCategory, selectedSubtopic, quizQuestion?.card.id)
    );
  }, [quizPool, quizQuestion?.card.id, selectedCategory, selectedSubtopic]);

  const handleTabChange = useCallback(
    (tab: AppTab) => {
      setActiveTab(tab);
      if (tab === 'quiz') {
        setQuizSelectedOptionId(null);
        setQuizQuestion(generateQuizQuestion(quizPool, selectedCategory, selectedSubtopic));
      }
    },
    [quizPool, selectedCategory, selectedSubtopic]
  );

  const handleUpdateCustomOrLocalField = useCallback(
    (cardId: string, patch: Partial<Pick<Flashcard, 'category' | 'subtopic'>>) => {
      const found = customCards.find((c) => c.id === cardId);
      if (found) {
        const updated = hydrateCard({
          ...found,
          ...patch,
          modified: true,
          updatedAt: Date.now(),
        });
        setCustomCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
        void recordCustomCardUpsertOptimistic(updated);
      } else if (isAdmin && currentUser) {
        const base = cards.find((c) => c.id === cardId);
        if (base) {
          void upsertGlobalCardAsAdmin(
            currentUser.uid,
            { ...base, ...patch, id: cardId },
            false
          ).catch(() => {});
        }
      }
    },
    [cards, currentUser, customCards, isAdmin]
  );

  const handleOpenNewCustomCard = useCallback(() => {
    setEditingCard(null);
    setCardModalCtx({ mode: 'custom' });
    setCardModalOpen(true);
  }, []);

  const handleEditCard = useCallback((c: Flashcard) => {
    setEditingCard(c);
    setCardModalCtx({ mode: 'custom' });
    setCardModalOpen(true);
  }, []);

  const handleOpenCover = useCallback(() => {
    setFocusMode(false);
    setShowCover(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleEnterFromCover = useCallback(
    (targetTab: AppTab = 'study') => {
      void triggerTap();
      handleTabChange(targetTab);
      setShowCover(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [handleTabChange]
  );

  const activeScopeSummary =
    studyScope === 'decks'
      ? `${connectedCards.length} conectados`
      : studyScope === 'selected'
      ? `${selectedStudyIds.size} em estudo`
      : `${cards.length} no acervo`;

  const cardModalDeckName =
    cardModalCtx.mode === 'custom_for_deck'
      ? userDecks.find((d) => d.id === cardModalCtx.deckId)?.name
      : undefined;

  const masteredCardsCount = useMemo(
    () => cards.filter((c) => c.status === 'mastered').length,
    [cards]
  );
  const reviewCardsCount = useMemo(
    () => cards.filter((c) => c.status === 'review').length,
    [cards]
  );
  const unseenCardsCount = useMemo(
    () => Math.max(0, cards.length - masteredCardsCount - reviewCardsCount),
    [cards.length, masteredCardsCount, reviewCardsCount]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {showCover ? (
        <CoverView
          theme={theme}
          onToggleTheme={handleToggleTheme}
          totalCards={cards.length}
          masteredCount={masteredCardsCount}
          reviewCount={reviewCardsCount}
          unseenCount={unseenCardsCount}
          decksCount={userDecks.length}
          syncStatus={syncStatus}
          syncLabel={syncLabel}
          userDisplayName={currentUser?.displayName || null}
          userEmail={currentUser?.email || null}
          isAdmin={isAdmin}
          isSigningIn={isSigningIn}
          stats={userStats}
          onOpenRankingModal={() => setRankingModalOpen(true)}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onOpenReminderModal={() => setReminderModalOpen(true)}
          onOpenDownloadModal={() => setDownloadModalOpen(true)}
          onSignInAndEnter={() => void handleGoogleSignInAndEnter()}
          onSignOut={() => void handleSignOut()}
          onEnterApp={handleEnterFromCover}
          onOpenAdminPanel={() => setAdminModalOpen(true)}
          onOpenPhoneticGuide={() => setPhoneticModalOpen(true)}
        />
      ) : (
        <>
          <Header
            activeTab={activeTab}
            onChangeTab={handleTabChange}
            onOpenCover={handleOpenCover}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((v) => !v)}
            onOpenPhoneticGuide={() => setPhoneticModalOpen(true)}
            onOpenReminderModal={() => setReminderModalOpen(true)}
            onOpenDownloadModal={() => setDownloadModalOpen(true)}
            reminderEnabled={reminderEnabled}
            onOpenNewCard={handleOpenNewCustomCard}
            totalCards={cards.length}
            decksCount={userDecks.length}
            activeScopeSummary={activeScopeSummary}
            syncStatus={syncStatus}
            syncLabel={syncLabel}
            pendingSyncCount={pendingSyncCount}
            userDisplayName={currentUser?.displayName || null}
            userEmail={currentUser?.email || null}
            isAdmin={isAdmin}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onOpenAdminPanel={() => setAdminModalOpen(true)}
          />

          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5 ios-safe-main">
            {!focusMode && (activeTab === 'study' || activeTab === 'list') && (
              <FilterToolbar
                selectedCategory={selectedCategory}
                onChangeCategory={(cat) => {
                  setSelectedCategory(cat);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                selectedSubtopic={selectedSubtopic}
                onChangeSubtopic={(sub) => {
                  setSelectedSubtopic(sub);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                selectedStatus={selectedStatus}
                onChangeStatus={(st) => {
                  setSelectedStatus(st);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                folderCounts={folderCounts}
                subtopicCounts={subtopicCounts}
                onShuffle={handleShuffle}
                showShuffle={activeTab === 'study'}
              />
            )}

            {activeTab === 'study' && (
              <StudyView
                cards={filteredStudyCards}
                currentIndex={currentIndex}
                isFlipped={isFlipped}
                studyScope={studyScope}
                selectedCount={selectedStudyIds.size}
                connectedCardsCount={connectedCards.length}
                totalDeckCount={cards.length}
                focusMode={focusMode}
                stats={userStats}
                onUpdateGoal={handleUpdateGoal}
                onOpenMonthlyStats={() => setRankingModalOpen(true)}
                onToggleFlip={handleToggleFlip}
                onPrev={handlePrevCard}
                onNext={handleNextCard}
                onMarkStatus={handleMarkStatus}
                onChangeScope={handleChangeScope}
                onQuickRandomSelection={handleQuickRandomSelection}
                onGoToList={() => setActiveTab('list')}
                onGoToDecks={() => setActiveTab('decks')}
                onEditCard={handleEditCard}
                onDeleteCard={setPendingDeleteCard}
                onToggleFocusMode={() => setFocusMode((v) => !v)}
                onResetFilters={() => {
                  setSelectedCategory('all');
                  setSelectedSubtopic('all');
                  setSelectedStatus('all');
                  handleChangeScope('all');
                }}
              />
            )}

            {activeTab === 'decks' && (
              <Suspense fallback={<ViewSuspenseFallback />}>
                <LazyDecksView
                  allCards={cards}
                  userDecks={userDecks}
                  connectedDeckIds={connectedDeckIds}
                  connectedCardsCount={connectedCards.length}
                  onToggleConnectDeck={handleToggleConnectDeck}
                  onStudySingleDeck={handleStudySingleDeck}
                  onStartConnectedStudy={() => {
                    handleChangeScope('decks');
                    setActiveTab('study');
                  }}
                  onStartConnectedQuiz={() => {
                    handleChangeScope('decks');
                    setQuizSelectedOptionId(null);
                    setQuizQuestion(
                      generateQuizQuestion(connectedCards, selectedCategory, selectedSubtopic)
                    );
                    setActiveTab('quiz');
                  }}
                  onCreateOrUpdateDeckMeta={handleCreateOrUpdateDeckMeta}
                  onDeleteDeck={setPendingDeleteDeck}
                  onToggleCardInDeck={handleToggleCardInDeck}
                  onOpenCreateCustomCard={(targetDeckId) => {
                    setEditingCard(null);
                    setCardModalCtx(
                      targetDeckId
                        ? { mode: 'custom_for_deck', deckId: targetDeckId }
                        : { mode: 'custom' }
                    );
                    setCardModalOpen(true);
                  }}
                />
              </Suspense>
            )}

            {activeTab === 'quiz' && (
              <Suspense fallback={<ViewSuspenseFallback />}>
                <LazyQuizView
                  question={quizQuestion}
                  selectedOptionId={quizSelectedOptionId}
                  score={quizScore}
                  totalAnswered={quizTotal}
                  onSelectOption={handleSelectQuizOption}
                  onNextQuestion={handleNextQuizQuestion}
                  onResetScore={handleResetQuizScore}
                />
              </Suspense>
            )}

            {activeTab === 'list' && (
              <Suspense fallback={<ViewSuspenseFallback />}>
                <LazyListView
                  cards={filteredListCards}
                  allCardsCount={cards.length}
                  selectedStudyIds={selectedStudyIds}
                  searchQuery={searchQuery}
                  onChangeSearch={setSearchQuery}
                  listSelectionFilter={listSelectionFilter}
                  onChangeSelectionFilter={setListSelectionFilter}
                  listViewMode={listViewMode}
                  onChangeViewMode={setListViewMode}
                  onToggleCardSelection={handleToggleCardSelection}
                  onSelectRandom={handleQuickRandomSelection}
                  onClearSelection={handleClearSelection}
                  onUpdateCardCategory={(cardId, category) => {
                    handleUpdateCustomOrLocalField(cardId, { category });
                    showToast(`Card movido para "${category}".`);
                  }}
                  onUpdateCardSubtopic={(cardId, subtopic) => {
                    handleUpdateCustomOrLocalField(cardId, { subtopic });
                    showToast(`Subtópico atualizado para "${subtopic}".`);
                  }}
                  onEditCard={handleEditCard}
                  onDeleteCard={setPendingDeleteCard}
                  onGoToStudy={() => {
                    handleChangeScope('selected');
                    setActiveTab('study');
                  }}
                  onNotify={showToast}
                />
              </Suspense>
            )}
          </main>

          {/* Ergonomic Smartphone Bottom Navigation (>= 48px tap targets + Safe Area) */}
          <MobileBottomNav
            activeTab={activeTab}
            decksCount={userDecks.length}
            totalCards={cards.length}
            focusMode={focusMode}
            onChangeTab={handleTabChange}
            onOpenNewCard={handleOpenNewCustomCard}
          />
        </>
      )}

      {/* Lazy-Loaded Modals */}
      {cardModalOpen && (
        <Suspense fallback={null}>
          <LazyCardModal
            isOpen={cardModalOpen}
            editingCard={editingCard}
            allCards={cards}
            contextTitle={
              cardModalCtx.mode === 'global_admin'
                ? editingCard
                  ? 'Editar Card Global (Todos os Usuários)'
                  : 'Disparar Novo Card Oficial'
                : cardModalCtx.mode === 'custom_for_deck'
                ? 'Nova Palavra Própria no Baralho'
                : undefined
            }
            contextSubtitle={
              cardModalCtx.mode === 'global_admin'
                ? 'Publicação imediata no acervo oficial de todos os alunos'
                : cardModalDeckName
                ? `Será adicionada automaticamente ao baralho "${cardModalDeckName}"`
                : undefined
            }
            onClose={() => {
              setCardModalOpen(false);
              setEditingCard(null);
            }}
            onSave={handleSaveCard}
          />
        </Suspense>
      )}

      {isAdmin && currentUser && adminModalOpen && (
        <Suspense fallback={null}>
          <LazyAdminModal
            isOpen={adminModalOpen}
            currentUserUid={currentUser.uid}
            currentUserEmail={currentUser.email}
            globalCards={globalCards}
            grantedAdmins={grantedAdmins}
            onClose={() => setAdminModalOpen(false)}
            onOpenNewGlobalCard={() => {
              setEditingCard(null);
              setCardModalCtx({ mode: 'global_admin' });
              setCardModalOpen(true);
            }}
            onEditGlobalCard={(card) => {
              setEditingCard(card);
              setCardModalCtx({ mode: 'global_admin' });
              setCardModalOpen(true);
            }}
            onToggleArchiveGlobalCard={async (card, archived) => {
              await upsertGlobalCardAsAdmin(currentUser.uid, card, archived);
              showToast(
                archived
                  ? `"${card.term}" ocultado para todos os alunos.`
                  : `"${card.term}" restaurado para todos os alunos.`
              );
            }}
            onDeleteGlobalOverride={async (cardId) => {
              await deleteGlobalCardFromCloud(cardId);
              showToast('Registro global removido.');
            }}
            onGrantAdmin={async (targetUid, label) => {
              await grantCoAdminByUid(currentUser.uid, targetUid, label);
              showToast(`Permissão de administrador concedida para ${label}.`);
            }}
            onRevokeAdmin={async (targetUid) => {
              await revokeCoAdminByUid(targetUid);
              showToast('Permissão de administrador revogada.');
            }}
          />
        </Suspense>
      )}

      {phoneticModalOpen && (
        <Suspense fallback={null}>
          <LazyPhoneticGrammarModal
            isOpen={phoneticModalOpen}
            onClose={() => setPhoneticModalOpen(false)}
          />
        </Suspense>
      )}

      {rankingModalOpen && (
        <Suspense fallback={null}>
          <LazyMonthlyRankingModal
            isOpen={rankingModalOpen}
            onClose={() => setRankingModalOpen(false)}
            stats={userStats}
            userDisplayName={currentUser?.displayName || null}
            onUpdateGoal={handleUpdateGoal}
          />
        </Suspense>
      )}

      {downloadModalOpen && (
        <Suspense fallback={null}>
          <LazyDownloadAppModal
            isOpen={downloadModalOpen}
            onClose={() => {
              setDownloadModalOpen(false);
              if (
                typeof window !== 'undefined' &&
                shouldOpenDownloadFromSearch(window.location.search)
              ) {
                const url = new URL(window.location.href);
                url.searchParams.delete('download');
                window.history.replaceState({}, '', url.pathname + url.search + url.hash);
              }
            }}
            onNotify={showToast}
          />
        </Suspense>
      )}

      <StudyReminderModal
        isOpen={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        onSaved={(summaryMsg) => {
          void loadStudyReminderConfig().then((cfg) => setReminderEnabled(cfg.enabled));
          showToast(summaryMsg);
        }}
      />

      <AuthAccountModal
        isOpen={authModalOpen}
        currentUser={currentUser}
        syncLabel={syncLabel}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user, msg) => {
          void triggerSuccess();
          setCurrentUser(user);
          if (showCover) setShowCover(false);
          showToast(msg);
        }}
        onSignedOut={() => {
          showToast('Sessão encerrada. Você está no modo visitante offline.');
        }}
        onAccountDeleted={handleAccountDeletedReset}
        onNotify={showToast}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteCard)}
        title="Remover flashcard?"
        description={
          pendingDeleteCard
            ? pendingDeleteCard.origin === 'custom'
              ? `Tem certeza que deseja excluir sua expressão "${pendingDeleteCard.term}"?`
              : `Deseja ocultar "${pendingDeleteCard.term}" da sua lista local?`
            : ''
        }
        confirmLabel="Remover"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteCard(null)}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteDeck)}
        title="Excluir baralho personalizado?"
        description={
          pendingDeleteDeck
            ? `O baralho "${pendingDeleteDeck.name}" será removido, mas todas as suas cartas continuarão salvas no seu acervo.`
            : ''
        }
        confirmLabel="Excluir baralho"
        tone="danger"
        onConfirm={handleConfirmDeleteDeck}
        onCancel={() => setPendingDeleteDeck(null)}
      />

      {/* Automatic Non-Intrusive Update Notification Banner */}
      <UpdateAvailableBanner
        update={availableUpdate}
        onApplyUpdate={(upd) => {
          showToast(`Iniciando atualização para ${upd.tagName}...`);
          void applyOneClickAppUpdate(upd);
        }}
        onDismiss={(tagName) => {
          dismissReleaseUpdateTag(tagName);
          setAvailableUpdate(null);
        }}
      />

      {/* Toast Notification (respecting Bottom Nav & Safe Area on Mobile) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 sm:right-5 ios-safe-toast z-50 rounded-2xl border border-[#E4E0D8] dark:border-[#365751] bg-[#1C1B18] dark:bg-[#232926] text-[#F6F4EF] dark:text-[#EBE7DE] px-4 py-2.5 text-xs font-semibold shadow-lg max-w-[calc(100vw-2rem)]"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
