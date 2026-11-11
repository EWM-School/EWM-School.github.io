import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminModal } from './components/AdminModal';
import { CardModal } from './components/CardModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CoverView } from './components/CoverView';
import { DecksView } from './components/DecksView';
import { FilterToolbar } from './components/FilterToolbar';
import { Header } from './components/Header';
import { ListView } from './components/ListView';
import { MonthlyRankingModal } from './components/MonthlyRankingModal';
import { PhoneticGrammarModal } from './components/PhoneticGrammarModal';
import { QuizView } from './components/QuizView';
import { RoundHistoryBar } from './components/RoundHistoryBar';
import { StudyView } from './components/StudyView';
import {
  loadUserStudyStats,
  recordCardReviewInStats,
  recordStudyTimeInStats,
  setDailyGoalInStats,
  type UserStudyStats,
} from './utils/studyMetrics';
import {
  DEFAULT_STARTER_STUDY_IDS,
  INITIAL_CARDS,
  MAX_STUDY_CARDS,
  MIN_STUDY_CARDS,
} from './data/seedData';
import {
  auth,
  checkIsUserAdmin,
  deleteCustomCardFromCloud,
  deleteGlobalCardFromCloud,
  deleteUserDeckFromCloud,
  ensureUserWorkspaceAndMigrate,
  grantCoAdminByUid,
  onAuthStateChanged,
  resetAllCardMasteryInCloud,
  revokeCoAdminByUid,
  saveCardMastery,
  signInWithGooglePopup,
  signOutUser,
  subscribeGlobalCards,
  subscribeGrantedAdmins,
  subscribeUserCloudData,
  updateUserWorkspaceSettings,
  upsertCustomCard,
  upsertGlobalCardAsAdmin,
  upsertUserDeck,
  type User,
} from './services/firebase';
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
  StudyRound,
  StudyScope,
  SubtopicKey,
  SyncStatus,
  ThemeMode,
  TopicFolder,
  UserDeck,
} from './types/flashcard';
import { shouldSkipCoverFromSearch } from './utils/coverHelpers';
import {
  computeFolderAndSubtopicCounts,
  filterListCards,
  filterStudyCards,
  generateQuizQuestion,
  hydrateCard,
  mergeCatalogAndUserCards,
  resolveConnectedDecksCards,
} from './utils/deckHelpers';
import { speakEnglishText } from './utils/speech';

const STORAGE_KEYS = {
  customCards: 'ewm_v5_visitor_custom_cards',
  legacyCards: 'ewm_flashcards_v4_cards',
  progressMap: 'ewm_v5_visitor_progress',
  decks: 'ewm_v5_visitor_decks',
  connectedDeckIds: 'ewm_v5_visitor_connected_decks',
  selectedIds: 'ewm_flashcards_v4_selected_ids',
  deletedIds: 'ewm_flashcards_v4_deleted_ids',
  rounds: 'ewm_flashcards_v4_rounds',
  theme: 'ewm_flashcards_v4_theme',
  studyScope: 'ewm_flashcards_v4_study_scope',
  legacyMarianaPhoto: 'ewm_v5_mariana_photo',
};

function loadVisitorCustomCards(): Flashcard[] {
  try {
    const rawV5 = localStorage.getItem(STORAGE_KEYS.customCards);
    if (rawV5) {
      const parsed = JSON.parse(rawV5);
      if (Array.isArray(parsed)) return parsed.map(hydrateCard);
    }
    const rawLegacy = localStorage.getItem(STORAGE_KEYS.legacyCards);
    if (rawLegacy) {
      const parsed: Flashcard[] = JSON.parse(rawLegacy);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c) => !INITIAL_CARDS.some((ic) => ic.id === c.id))
          .map((c) => hydrateCard({ ...c, origin: 'custom' }));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function loadVisitorProgressMap(): Record<string, CardProgressEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progressMap);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    const rawLegacy = localStorage.getItem(STORAGE_KEYS.legacyCards);
    if (rawLegacy) {
      const parsed: Flashcard[] = JSON.parse(rawLegacy);
      const map: Record<string, CardProgressEntry> = {};
      for (const c of parsed) {
        if (c.status === 'mastered' || c.status === 'review') {
          map[c.id] = { cardId: c.id, masteryLevel: c.status, roundMarked: 1 };
        }
      }
      return map;
    }
  } catch {
    // ignore
  }
  return {};
}

function loadVisitorDecks(): UserDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.decks);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function loadVisitorConnectedDeckIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.connectedDeckIds);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function loadInitialSelectedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.selectedIds);
    if (raw) {
      const arr: string[] = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        return new Set(arr.slice(0, MAX_STUDY_CARDS));
      }
    }
  } catch {
    // fallback below
  }
  return new Set(DEFAULT_STARTER_STUDY_IDS);
}

function loadInitialRounds(): StudyRound[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rounds);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [{ round: 1, startedAt: Date.now(), masteredIds: [], reviewIds: [] }];
}

function loadInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

type CardModalContext =
  | { mode: 'custom' }
  | { mode: 'custom_for_deck'; deckId: string }
  | { mode: 'global_admin' };

export default function App() {
  // Auth & Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('visitor');

  // Data Sources
  const [globalCards, setGlobalCards] = useState<Flashcard[]>([]);
  const [customCards, setCustomCards] = useState<Flashcard[]>(() => loadVisitorCustomCards());
  const [progressMap, setProgressMap] = useState<Record<string, CardProgressEntry>>(() =>
    loadVisitorProgressMap()
  );
  const [userDecks, setUserDecks] = useState<UserDeck[]>(() => loadVisitorDecks());
  const [connectedDeckIds, setConnectedDeckIds] = useState<string[]>(() =>
    loadVisitorConnectedDeckIds()
  );
  const [grantedAdmins, setGrantedAdmins] = useState<AdminRecord[]>([]);

  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.deletedIds);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [selectedStudyIds, setSelectedStudyIds] = useState<Set<string>>(() =>
    loadInitialSelectedIds()
  );
  const [studyRounds, setStudyRounds] = useState<StudyRound[]>(() => loadInitialRounds());
  const [theme, setTheme] = useState<ThemeMode>(() => loadInitialTheme());
  const [shuffleOrderIds, setShuffleOrderIds] = useState<string[] | null>(null);
  const [showCover, setShowCover] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !shouldSkipCoverFromSearch(window.location.search);
  });
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('study');
  const [studyScope, setStudyScope] = useState<StudyScope>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.studyScope);
      if (saved === 'all' || saved === 'decks' || saved === 'selected') return saved;
      return 'selected';
    } catch {
      return 'selected';
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<'all' | TopicFolder>('all');
  const [selectedSubtopic, setSelectedSubtopic] = useState<'all' | SubtopicKey>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [listSelectionFilter, setListSelectionFilter] = useState<ListSelectionFilter>('all');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('grid');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Modals & notifications
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardModalCtx, setCardModalCtx] = useState<CardModalContext>({ mode: 'custom' });
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [phoneticModalOpen, setPhoneticModalOpen] = useState(false);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<Flashcard | null>(null);
  const [pendingDeleteDeck, setPendingDeleteDeck] = useState<UserDeck | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [rankingModalOpen, setRankingModalOpen] = useState(false);
  const [userStats, setUserStats] = useState<UserStudyStats>(() => loadUserStudyStats());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const wsDebounceRef = useRef<number | null>(null);
  const cloudReadyForUidRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  const handleUpdateGoal = useCallback((newGoal: number) => {
    setUserStats((prev) => setDailyGoalInStats(newGoal, prev));
    showToast(`Meta diária atualizada para ${newGoal} cards.`);
  }, [showToast]);

  // Track active study minutes in the current month
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!showCover && (activeTab === 'study' || activeTab === 'quiz')) {
        setUserStats((prev) => recordStudyTimeInStats(15, prev));
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

  // Quiz state
  const quizPool = useMemo(
    () => (studyScope === 'decks' && connectedCards.length >= 4 ? connectedCards : cards),
    [studyScope, connectedCards, cards]
  );

  const [quizQuestion, setQuizQuestion] = useState<QuizQuestion | null>(() =>
    generateQuizQuestion(INITIAL_CARDS.map(hydrateCard), 'all', 'all')
  );
  const [quizSelectedOptionId, setQuizSelectedOptionId] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);

  // Sync dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Purge any previously cached custom portrait so Cover portrait remains strictly immutable
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.legacyMarianaPhoto);
    } catch {
      // ignore
    }
  }, []);

  // Keep visitor localStorage updated when signed out
  useEffect(() => {
    if (currentUser) return;
    try {
      localStorage.setItem(STORAGE_KEYS.customCards, JSON.stringify(customCards));
      localStorage.setItem(STORAGE_KEYS.progressMap, JSON.stringify(progressMap));
      localStorage.setItem(STORAGE_KEYS.decks, JSON.stringify(userDecks));
      localStorage.setItem(STORAGE_KEYS.connectedDeckIds, JSON.stringify(connectedDeckIds));
      localStorage.setItem(
        STORAGE_KEYS.selectedIds,
        JSON.stringify(Array.from(selectedStudyIds))
      );
      localStorage.setItem(STORAGE_KEYS.deletedIds, JSON.stringify(deletedIds));
      localStorage.setItem(STORAGE_KEYS.rounds, JSON.stringify(studyRounds));
      localStorage.setItem(STORAGE_KEYS.studyScope, studyScope);
    } catch {
      // ignore
    }
  }, [
    currentUser,
    customCards,
    progressMap,
    userDecks,
    connectedDeckIds,
    selectedStudyIds,
    deletedIds,
    studyRounds,
    studyScope,
  ]);

  // 1. Firebase Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (!user) {
        cloudReadyForUidRef.current = null;
        setIsAdmin(false);
        setGrantedAdmins([]);
        setSyncStatus('visitor');
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. Subscribe to Global Official Cards once Auth state is initialized
  useEffect(() => {
    if (!isAuthReady) return;
    let unsubGlobal: (() => void) | null = null;
    try {
      unsubGlobal = subscribeGlobalCards((items) => {
        setGlobalCards(items);
      });
    } catch {
      // handled inside subscribeGlobalCards
    }
    return () => {
      if (unsubGlobal) unsubGlobal();
    };
  }, [isAuthReady]);

  // 3. Initialize User Cloud Workspace + Migrate Visitor Data + Attach Real-time Listeners
  const latestVisitorSeedRef = useRef({
    studyScope,
    selectedCardIds: Array.from(selectedStudyIds),
    connectedDeckIds,
    activeRound: studyRounds[studyRounds.length - 1]?.round || 1,
    customCards,
    decks: userDecks,
    progressMap,
  });
  latestVisitorSeedRef.current = {
    studyScope,
    selectedCardIds: Array.from(selectedStudyIds),
    connectedDeckIds,
    activeRound: studyRounds[studyRounds.length - 1]?.round || 1,
    customCards,
    decks: userDecks,
    progressMap,
  };

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;
    let cancelled = false;
    let unsubUser: (() => void) | null = null;
    let unsubAdmins: (() => void) | null = null;

    const bootCloudSession = async () => {
      setSyncStatus('syncing');
      try {
        const adminFlag = await checkIsUserAdmin(currentUser);
        if (!cancelled) setIsAdmin(adminFlag);

        const seed = latestVisitorSeedRef.current;
        const { createdNew, workspace } = await ensureUserWorkspaceAndMigrate(currentUser.uid, {
          studyScope: seed.studyScope,
          selectedCardIds: seed.selectedCardIds,
          connectedDeckIds: seed.connectedDeckIds,
          activeRound: seed.activeRound,
          customCards: seed.customCards,
          decks: seed.decks,
          progressEntries: Object.values(seed.progressMap),
        });

        if (cancelled) return;

        if (!createdNew) {
          setStudyScope(workspace.studyScope);
          if (workspace.selectedCardIds.length > 0) {
            setSelectedStudyIds(new Set(workspace.selectedCardIds));
          }
          setConnectedDeckIds(workspace.connectedDeckIds);
        }

        cloudReadyForUidRef.current = currentUser.uid;
        setSyncStatus('synced');

        unsubUser = subscribeUserCloudData(currentUser.uid, {
          onWorkspace: (ws) => {
            setStudyScope(ws.studyScope);
            setSelectedStudyIds(new Set(ws.selectedCardIds));
            setConnectedDeckIds(ws.connectedDeckIds);
          },
          onCustomCards: (cloudCustom) => {
            setCustomCards(cloudCustom);
          },
          onDecks: (cloudDecks) => {
            setUserDecks(cloudDecks);
          },
          onProgressMap: (cloudProgress) => {
            setProgressMap(cloudProgress);
          },
        });

        if (adminFlag) {
          unsubAdmins = subscribeGrantedAdmins(currentUser.uid, (list) => {
            setGrantedAdmins(list);
          });
        }
      } catch {
        if (!cancelled) {
          setSyncStatus('error');
        }
      }
    };

    void bootCloudSession();

    return () => {
      cancelled = true;
      if (unsubUser) unsubUser();
      if (unsubAdmins) unsubAdmins();
    };
  }, [isAuthReady, currentUser]);

  // Helper to schedule debounced workspace settings save in Firestore
  const scheduleWorkspaceCloudSync = useCallback(
    (nextPatch: {
      studyScope?: StudyScope;
      selectedCardIds?: string[];
      connectedDeckIds?: string[];
      activeRound?: number;
    }) => {
      if (!currentUser || cloudReadyForUidRef.current !== currentUser.uid) return;
      const uid = currentUser.uid;
      const payload = {
        studyScope: nextPatch.studyScope ?? studyScope,
        selectedCardIds: nextPatch.selectedCardIds ?? Array.from(selectedStudyIds),
        connectedDeckIds: nextPatch.connectedDeckIds ?? connectedDeckIds,
        activeRound:
          nextPatch.activeRound ?? (studyRounds[studyRounds.length - 1]?.round || 1),
      };

      setSyncStatus('syncing');
      if (wsDebounceRef.current) window.clearTimeout(wsDebounceRef.current);
      wsDebounceRef.current = window.setTimeout(async () => {
        try {
          await updateUserWorkspaceSettings(uid, payload);
          setSyncStatus('synced');
        } catch {
          setSyncStatus('error');
        }
      }, 650);
    },
    [currentUser, studyScope, selectedStudyIds, connectedDeckIds, studyRounds]
  );

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

  const handleSignIn = async (enterAfterLogin = false) => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const user = await signInWithGooglePopup();
      if (enterAfterLogin) {
        setShowCover(false);
      }
      showToast(`Bem-vindo(a), ${user.displayName?.split(' ')[0] || 'aluno'}! Salvamento na nuvem ativo.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showToast('Não foi possível concluir o login com Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    showToast('Sessão encerrada. Você está no modo visitante local.');
  };

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

      const currentRound = studyRounds[studyRounds.length - 1]?.round || 1;

      setProgressMap((prev) => ({
        ...prev,
        [current.id]: {
          cardId: current.id,
          masteryLevel: newStatus,
          roundMarked: currentRound,
        },
      }));

      setStudyRounds((prev) => {
        const copy = [...prev];
        const last = { ...copy[copy.length - 1] };
        last.masteredIds = last.masteredIds.filter((id) => id !== current.id);
        last.reviewIds = last.reviewIds.filter((id) => id !== current.id);
        if (newStatus === 'mastered') {
          last.masteredIds = [...last.masteredIds, current.id];
        } else {
          last.reviewIds = [...last.reviewIds, current.id];
        }
        copy[copy.length - 1] = last;
        return copy;
      });

      if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
        setSyncStatus('syncing');
        void saveCardMastery(currentUser.uid, current.id, newStatus, currentRound)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'));
      }

      // Record daily card review and active day into personal metrics
      setUserStats((prev) => recordCardReviewInStats(current.id, prev));

      showToast(
        newStatus === 'mastered' ? 'Marcado como dominado.' : 'Marcado para revisar depois.'
      );
      setIsFlipped(false);
      setCurrentIndex((prev) => (prev + 1 < filteredStudyCards.length ? prev + 1 : 0));
    },
    [filteredStudyCards, currentIndex, studyRounds, currentUser, showToast]
  );

  // Keyboard shortcuts for Study Mode
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
        setPendingDeleteCard(null);
        setPendingDeleteDeck(null);
        setConfirmResetOpen(false);
        if (focusMode) setFocusMode(false);
        return;
      }

      if (
        isInput ||
        showCover ||
        cardModalOpen ||
        adminModalOpen ||
        phoneticModalOpen ||
        pendingDeleteCard ||
        pendingDeleteDeck ||
        confirmResetOpen
      ) {
        return;
      }

      if (e.key.toLowerCase() === 'f' && activeTab === 'study') {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }

      if (activeTab !== 'study') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((v) => !v);
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
      } else if (e.key.toLowerCase() === 'u' || e.key.toLowerCase() === 'b') {
        if (filteredStudyCards.length > 0) {
          e.preventDefault();
          const safeIdx = Math.min(currentIndex, filteredStudyCards.length - 1);
          const current = filteredStudyCards[safeIdx];
          if (current) {
            void speakEnglishText(current.term, e.key.toLowerCase() === 'b' ? 'uk' : 'us');
          }
        }
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
    pendingDeleteCard,
    pendingDeleteDeck,
    confirmResetOpen,
    filteredStudyCards,
    currentIndex,
    handleNextCard,
    handlePrevCard,
    handleMarkStatus,
  ]);

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5).map((c) => c.id);
    setShuffleOrderIds(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    showToast('Ordem dos cards embaralhada.');
  };

  const handleChangeScope = (scope: StudyScope) => {
    setStudyScope(scope);
    setCurrentIndex(0);
    setIsFlipped(false);
    scheduleWorkspaceCloudSync({ studyScope: scope });
  };

  const handleToggleCardSelection = (cardId: string) => {
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
      scheduleWorkspaceCloudSync({ selectedCardIds: Array.from(next) });
      return next;
    });
  };

  const handleQuickRandomSelection = (qty: number) => {
    const count = Math.max(MIN_STUDY_CARDS, Math.min(MAX_STUDY_CARDS, qty));
    const pool = [...cards].sort(() => Math.random() - 0.5);
    const chosenArr = pool.slice(0, Math.min(count, pool.length)).map((c) => c.id);
    setSelectedStudyIds(new Set(chosenArr));
    setStudyScope('selected');
    setCurrentIndex(0);
    setIsFlipped(false);
    scheduleWorkspaceCloudSync({ studyScope: 'selected', selectedCardIds: chosenArr });
    showToast(`${chosenArr.length} cards sorteados para sua sessão de estudo.`);
  };

  const handleClearSelection = () => {
    setSelectedStudyIds(new Set());
    scheduleWorkspaceCloudSync({ selectedCardIds: [] });
    showToast('Seleção de estudo limpa.');
  };

  /**
   * Connectable & Mixable Student Decks Handlers
   */
  const handleCreateOrUpdateDeckMeta = (
    meta: { name: string; description: string; colorTag: DeckColorTag },
    existingDeck?: UserDeck
  ): string => {
    if (existingDeck) {
      const updated: UserDeck = { ...existingDeck, ...meta, updatedAt: Date.now() };
      setUserDecks((prev) => prev.map((d) => (d.id === existingDeck.id ? updated : d)));
      if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
        setSyncStatus('syncing');
        void upsertUserDeck(currentUser.uid, updated)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'));
      }
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

    // Auto-connect newly created deck if under 12 connected decks
    setConnectedDeckIds((prev) => {
      if (prev.includes(newDeckId) || prev.length >= 12) return prev;
      const next = [...prev, newDeckId];
      scheduleWorkspaceCloudSync({ connectedDeckIds: next });
      return next;
    });

    if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
      setSyncStatus('syncing');
      void upsertUserDeck(currentUser.uid, newDeck)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }
    showToast(`Baralho "${meta.name}" criado! Agora escolha ou crie suas cartas.`);
    return newDeckId;
  };

  const handleToggleCardInDeck = (deckId: string, cardId: string) => {
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

      if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
        setSyncStatus('syncing');
        void upsertUserDeck(currentUser.uid, updatedDeck)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'));
      }

      return prev.map((d) => (d.id === deckId ? updatedDeck : d));
    });
  };

  const handleToggleConnectDeck = (deckId: string) => {
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
      scheduleWorkspaceCloudSync({ connectedDeckIds: next });
      return next;
    });
  };

  const handleStudySingleDeck = (deckId: string) => {
    const next = [deckId];
    setConnectedDeckIds(next);
    setStudyScope('decks');
    setActiveTab('study');
    setCurrentIndex(0);
    setIsFlipped(false);
    scheduleWorkspaceCloudSync({ connectedDeckIds: next, studyScope: 'decks' });
  };

  const handleConfirmDeleteDeck = () => {
    if (!pendingDeleteDeck) return;
    const target = pendingDeleteDeck;
    setUserDecks((prev) => prev.filter((d) => d.id !== target.id));
    setConnectedDeckIds((prev) => {
      const next = prev.filter((id) => id !== target.id);
      scheduleWorkspaceCloudSync({ connectedDeckIds: next });
      return next;
    });
    if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
      setSyncStatus('syncing');
      void deleteUserDeckFromCloud(currentUser.uid, target.id)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }
    setPendingDeleteDeck(null);
    showToast(`Baralho "${target.name}" excluído.`);
  };

  /**
   * Unified Card Save Handler (Custom Student Card, Deck-Targeted Card, or Global Admin Card)
   */
  const handleSaveCard = (
    cardData: Omit<Flashcard, 'id' | 'status'>,
    existingId?: string
  ) => {
    // Branch 1: Admin broadcasting or editing a Global Official Card
    if (cardModalCtx.mode === 'global_admin' && isAdmin && currentUser) {
      const targetId = existingId || `global_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setSyncStatus('syncing');
      void upsertGlobalCardAsAdmin(
        currentUser.uid,
        { id: targetId, ...cardData },
        false
      )
        .then(() => {
          setSyncStatus('synced');
          showToast(
            existingId
              ? `"${cardData.term}" atualizado para todos os usuários.`
              : `"${cardData.term}" disparado para todos os usuários!`
          );
        })
        .catch(() => {
          setSyncStatus('error');
          showToast('Erro ao salvar card global.');
        });
      setCardModalOpen(false);
      setEditingCard(null);
      return;
    }

    // Branch 2: Editing an existing card from Study/List
    if (existingId) {
      const isOfficial = !existingId.startsWith('custom_');
      if (isOfficial && isAdmin && currentUser) {
        setSyncStatus('syncing');
        void upsertGlobalCardAsAdmin(
          currentUser.uid,
          { id: existingId, ...cardData },
          false
        )
          .then(() => {
            setSyncStatus('synced');
            showToast(`"${cardData.term}" atualizado no acervo global.`);
          })
          .catch(() => setSyncStatus('error'));
      } else if (!isOfficial) {
        const updatedCard: Flashcard = hydrateCard({
          id: existingId,
          status: progressMap[existingId]?.masteryLevel || 'unseen',
          origin: 'custom',
          ...cardData,
        });
        setCustomCards((prev) =>
          prev.map((c) => (c.id === existingId ? updatedCard : c))
        );
        if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
          setSyncStatus('syncing');
          void upsertCustomCard(currentUser.uid, updatedCard)
            .then(() => setSyncStatus('synced'))
            .catch(() => setSyncStatus('error'));
        }
        showToast(`"${cardData.term}" atualizado.`);
      } else {
        // Student customizing an official card creates a personal copy in Minhas Criações
        const forkId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const forkedCard: Flashcard = hydrateCard({
          id: forkId,
          status: 'unseen',
          origin: 'custom',
          ...cardData,
        });
        setCustomCards((prev) => [forkedCard, ...prev]);
        if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
          setSyncStatus('syncing');
          void upsertCustomCard(currentUser.uid, forkedCard)
            .then(() => setSyncStatus('synced'))
            .catch(() => setSyncStatus('error'));
        }
        showToast(`Versão personalizada de "${cardData.term}" salva em Minhas Criações.`);
      }
      setCardModalOpen(false);
      setEditingCard(null);
      return;
    }

    // Branch 3: Creating a brand-new Student Custom Card (optionally directly inside a Deck!)
    const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCard: Flashcard = hydrateCard({
      id: newId,
      status: 'unseen',
      origin: 'custom',
      ...cardData,
    });
    setCustomCards((prev) => [newCard, ...prev]);

    if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
      setSyncStatus('syncing');
      void upsertCustomCard(currentUser.uid, newCard)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }

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
        if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
          void upsertUserDeck(currentUser.uid, updatedDeck);
        }
        return prev.map((d) => (d.id === targetDeckId ? updatedDeck : d));
      });
      showToast(`"${cardData.term}" criada e já adicionada ao seu baralho!`);
    } else {
      setSelectedStudyIds((prev) => {
        if (prev.size >= MAX_STUDY_CARDS) return prev;
        const next = new Set(prev);
        next.add(newId);
        scheduleWorkspaceCloudSync({ selectedCardIds: Array.from(next) });
        return next;
      });
      setCurrentIndex(0);
      setIsFlipped(false);
      showToast(`"${cardData.term}" criada em Minhas Criações!`);
    }

    setCardModalOpen(false);
    setEditingCard(null);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteCard) return;
    const target = pendingDeleteCard;

    if (target.origin === 'custom' || target.id.startsWith('custom_')) {
      setCustomCards((prev) => prev.filter((c) => c.id !== target.id));
      if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
        setSyncStatus('syncing');
        void deleteCustomCardFromCloud(currentUser.uid, target.id)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'));
      }
    } else {
      setDeletedIds((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]));
    }

    setSelectedStudyIds((prev) => {
      const next = new Set(prev);
      if (next.delete(target.id)) {
        scheduleWorkspaceCloudSync({ selectedCardIds: Array.from(next) });
      }
      return next;
    });

    setPendingDeleteCard(null);
    showToast(`"${target.term}" removido.`);
  };

  const handleConfirmResetProgress = () => {
    const previousProgressIds = Object.keys(progressMap);
    const nextRoundNum = (studyRounds[studyRounds.length - 1]?.round || 0) + 1;

    setProgressMap({});
    setStudyRounds((prev) => [
      ...prev,
      {
        round: nextRoundNum,
        startedAt: Date.now(),
        masteredIds: [],
        reviewIds: [],
      },
    ]);

    if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
      setSyncStatus('syncing');
      void resetAllCardMasteryInCloud(currentUser.uid, previousProgressIds, nextRoundNum)
        .then(() => updateUserWorkspaceSettings(currentUser.uid, {
          studyScope,
          selectedCardIds: Array.from(selectedStudyIds),
          connectedDeckIds,
          activeRound: nextRoundNum,
        }))
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }

    setConfirmResetOpen(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    showToast('Nova rodada iniciada com todos os cards zerados.');
  };

  const handleJumpToCard = (cardId: string) => {
    setActiveTab('study');
    setStudyScope('all');
    setSelectedCategory('all');
    setSelectedSubtopic('all');
    setSelectedStatus('all');
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      setCurrentIndex(idx);
      setIsFlipped(false);
    }
  };

  const handleSelectQuizOption = (option: QuizOption) => {
    if (quizSelectedOptionId !== null) return;
    setQuizSelectedOptionId(option.id);
    setQuizTotal((t) => t + 1);
    if (option.isCorrect) setQuizScore((s) => s + 1);
  };

  const handleNextQuizQuestion = () => {
    setQuizSelectedOptionId(null);
    setQuizQuestion(
      generateQuizQuestion(quizPool, selectedCategory, selectedSubtopic, quizQuestion?.card.id)
    );
  };

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === 'quiz') {
      setQuizSelectedOptionId(null);
      setQuizQuestion(generateQuizQuestion(quizPool, selectedCategory, selectedSubtopic));
    }
  };

  const handleUpdateCustomOrLocalField = (
    cardId: string,
    patch: Partial<Pick<Flashcard, 'category' | 'subtopic'>>
  ) => {
    const found = customCards.find((c) => c.id === cardId);
    if (found) {
      const updated = hydrateCard({ ...found, ...patch, modified: true });
      setCustomCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
      if (currentUser && cloudReadyForUidRef.current === currentUser.uid) {
        setSyncStatus('syncing');
        void upsertCustomCard(currentUser.uid, updated)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'));
      }
    } else if (isAdmin && currentUser) {
      const base = cards.find((c) => c.id === cardId);
      if (base) {
        setSyncStatus('syncing');
        void upsertGlobalCardAsAdmin(
          currentUser.uid,
          { ...base, ...patch, id: cardId },
          false
        )
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('error'));
      }
    }
  };

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

  const handleEnterFromCover = (targetTab: AppTab = 'study') => {
    handleTabChange(targetTab);
    setShowCover(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {showCover ? (
        <CoverView
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          totalCards={cards.length}
          masteredCount={masteredCardsCount}
          reviewCount={reviewCardsCount}
          unseenCount={unseenCardsCount}
          decksCount={userDecks.length}
          syncStatus={syncStatus}
          userDisplayName={currentUser?.displayName || null}
          userEmail={currentUser?.email || null}
          isAdmin={isAdmin}
          isSigningIn={isSigningIn}
          stats={userStats}
          onUpdateGoal={handleUpdateGoal}
          onSignInAndEnter={() => void handleSignIn(true)}
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
            onOpenCover={() => {
              setFocusMode(false);
              setShowCover(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((v) => !v)}
            onOpenPhoneticGuide={() => setPhoneticModalOpen(true)}
            onOpenNewCard={() => {
              setEditingCard(null);
              setCardModalCtx({ mode: 'custom' });
              setCardModalOpen(true);
            }}
            totalCards={cards.length}
            decksCount={userDecks.length}
            activeScopeSummary={activeScopeSummary}
            syncStatus={syncStatus}
            userDisplayName={currentUser?.displayName || null}
            userEmail={currentUser?.email || null}
            isAdmin={isAdmin}
            onSignIn={() => void handleSignIn(false)}
            onSignOut={() => void handleSignOut()}
            onOpenAdminPanel={() => setAdminModalOpen(true)}
          />

          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">
        {!focusMode && activeTab !== 'decks' && (
          <RoundHistoryBar
            cards={cards}
            studyRounds={studyRounds}
            onResetProgress={() => setConfirmResetOpen(true)}
            onJumpToCard={handleJumpToCard}
          />
        )}

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
            onToggleFlip={() => setIsFlipped((v) => !v)}
            onPrev={handlePrevCard}
            onNext={handleNextCard}
            onMarkStatus={handleMarkStatus}
            onChangeScope={handleChangeScope}
            onQuickRandomSelection={handleQuickRandomSelection}
            onGoToList={() => setActiveTab('list')}
            onGoToDecks={() => setActiveTab('decks')}
            onEditCard={(c) => {
              setEditingCard(c);
              setCardModalCtx({ mode: 'custom' });
              setCardModalOpen(true);
            }}
            onDeleteCard={(c) => setPendingDeleteCard(c)}
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
          <DecksView
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
            onDeleteDeck={(deck) => setPendingDeleteDeck(deck)}
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
        )}

        {activeTab === 'quiz' && (
          <QuizView
            question={quizQuestion}
            selectedOptionId={quizSelectedOptionId}
            score={quizScore}
            totalAnswered={quizTotal}
            onSelectOption={handleSelectQuizOption}
            onNextQuestion={handleNextQuizQuestion}
            onResetScore={() => {
              setQuizScore(0);
              setQuizTotal(0);
              handleNextQuizQuestion();
            }}
          />
        )}

        {activeTab === 'list' && (
          <ListView
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
            onEditCard={(c) => {
              setEditingCard(c);
              setCardModalCtx({ mode: 'custom' });
              setCardModalOpen(true);
            }}
            onDeleteCard={(c) => setPendingDeleteCard(c)}
            onGoToStudy={() => {
              handleChangeScope('selected');
              setActiveTab('study');
            }}
            onNotify={showToast}
          />
        )}
          </main>
        </>
      )}

      {/* Modals */}
      <CardModal
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

      {isAdmin && currentUser && (
        <AdminModal
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
            setSyncStatus('syncing');
            await upsertGlobalCardAsAdmin(currentUser.uid, card, archived);
            setSyncStatus('synced');
            showToast(
              archived
                ? `"${card.term}" ocultado para todos os alunos.`
                : `"${card.term}" restaurado para todos os alunos.`
            );
          }}
          onDeleteGlobalOverride={async (cardId) => {
            setSyncStatus('syncing');
            await deleteGlobalCardFromCloud(cardId);
            setSyncStatus('synced');
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
      )}

      <PhoneticGrammarModal
        isOpen={phoneticModalOpen}
        onClose={() => setPhoneticModalOpen(false)}
      />

      <MonthlyRankingModal
        isOpen={rankingModalOpen}
        onClose={() => setRankingModalOpen(false)}
        stats={userStats}
        userDisplayName={currentUser?.displayName || null}
        onUpdateGoal={handleUpdateGoal}
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

      <ConfirmModal
        isOpen={confirmResetOpen}
        title="Iniciar nova rodada?"
        description="Todos os cards voltarão para o status inicial para você praticar novamente, mantendo o histórico das rodadas anteriores."
        confirmLabel="Iniciar nova rodada"
        tone="primary"
        onConfirm={handleConfirmResetProgress}
        onCancel={() => setConfirmResetOpen(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 rounded-2xl border border-[#E4E0D8] dark:border-[#365751] bg-[#1C1B18] dark:bg-[#232926] text-[#F6F4EF] dark:text-[#EBE7DE] px-4 py-2.5 text-xs font-semibold shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
