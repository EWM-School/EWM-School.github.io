import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Flame,
  FolderOpen,
  Gamepad2,
  HelpCircle,
  Info,
  Play,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { VALID_FOLDERS, VALID_SUBTOPICS } from '../data/seedData';
import { triggerTap } from '../services/platform/hapticsService';
import { stopCurrentAudio } from '../services/platform/speechService';
import type {
  Flashcard,
  QuizOption,
  QuizQuestion,
  SubtopicKey,
  TopicFolder,
} from '../types/flashcard';
import {
  resolveMiniGameCardPool,
  type ArenaTrainingScopeMode,
} from '../utils/gameContentNormalizer';
import {
  ARENA_FREE_TRAINING_BADGE_PT,
  getDailyGamesXpSnapshot,
  type MiniGameId,
  type MiniGameSessionMetrics,
  type MiniGameXpAwardOutcome,
} from '../utils/gameXpPolicy';
import {
  computeLeaderboard,
  getMonthNamePt,
  type CloudLeaderboardRecord,
  type UserStudyStats,
} from '../utils/studyMetrics';
import { QuizView } from './QuizView';
import { ExpressionBuilderGame } from './games/ExpressionBuilderGame';
import { LightningMatchGame } from './games/LightningMatchGame';
import { NativeEarGame } from './games/NativeEarGame';
import { SurvivalChallengeGame } from './games/SurvivalChallengeGame';

type ActiveArenaMode = 'arena' | 'quiz' | MiniGameId;

interface GamesHubViewProps {
  allCards: Flashcard[];
  question: QuizQuestion | null;
  selectedOptionId: string | null;
  score: number;
  totalAnswered: number;
  defaultOpenQuiz?: boolean;
  stats: UserStudyStats;
  userDisplayName: string | null;
  userEmail: string | null;
  currentUid: string | null;
  masteredCount: number;
  reviewCount: number;
  cloudLeaderboard: CloudLeaderboardRecord[];
  onSelectOption: (option: QuizOption) => void;
  onNextQuestion: () => void;
  onResetScore: () => void;
  onCompleteMiniGame: (metrics: MiniGameSessionMetrics) => MiniGameXpAwardOutcome;
  onOpenRankingModal: () => void;
  onShareQuizAchievement?: (featuredCard: Flashcard | null) => void;
}

interface ArenaGameDescriptor {
  id: MiniGameId;
  title: string;
  bentoTagline: string;
  subtitle: string;
  description: string;
  xpBadge: string;
  ctaLabel: string;
  cardSurfaceClass: string;
  ctaButtonClass: string;
}

const ARENA_MINI_GAMES: readonly ArenaGameDescriptor[] = [
  {
    id: 'expression-builder',
    title: 'Monte a Expressão',
    bentoTagline: 'Construtor de blocos',
    subtitle: 'Expression / Sentence Builder',
    description:
      'Ordene sintagmas e palavras reais em inglês a partir da tradução natural em português, com dica sonora US/UK e zero falsos negativos.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Montar Frases',
    cardSurfaceClass:
      'border-[#38BDF8]/42 dark:border-[#38BDF8]/34 bg-gradient-to-b from-[#F0F9FF] via-white to-[#F8FCFF] dark:from-[#152234] dark:via-[#121D2D] dark:to-[#0F1825] hover:border-[#0284C7] dark:hover:border-[#38BDF8]/70 shadow-[0_6px_18px_rgba(56,189,248,0.12)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.42),0_0_18px_rgba(56,189,248,0.08)]',
    ctaButtonClass:
      'bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#38BDF8]/20 dark:hover:bg-[#38BDF8]/30 dark:border dark:border-[#38BDF8]/45 text-white dark:text-[#BAE6FD]',
  },
  {
    id: 'native-ear',
    title: 'Ouvido de Nativo',
    bentoTagline: 'Escuta relâmpago US/UK',
    subtitle: 'Native Ear Sprint · US & UK',
    description:
      '8 rodadas de compreensão auditiva pura (12s por questão) com liberdade total para ouvir US e UK quantas vezes quiser.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Treinar Escuta',
    cardSurfaceClass:
      'border-[#10D990]/48 dark:border-[#38E5A5]/38 bg-gradient-to-b from-[#ECFDF5] via-white to-[#F5FEFA] dark:from-[#132820] dark:via-[#11221B] dark:to-[#0D1A15] hover:border-[#00C982] dark:hover:border-[#38E5A5]/75 shadow-[0_6px_18px_rgba(16,217,144,0.15)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.42),0_0_20px_rgba(56,229,165,0.10)]',
    ctaButtonClass:
      'bg-[#00A86E] hover:bg-[#008F5D] dark:bg-[#38E5A5]/22 dark:hover:bg-[#38E5A5]/32 dark:border dark:border-[#38E5A5]/50 text-white dark:text-[#6EE7B7]',
  },
  {
    id: 'lightning-match',
    title: 'Memória Relâmpago',
    bentoTagline: 'Pares em ritmo arcade',
    subtitle: 'Lightning Match · Groove Sintetizado',
    description:
      'Conecte expressões em inglês ao equivalente natural do Brasil em ritmo visual fluido com trilha procedural suave e zero voz sobreposta.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Conectar Pares',
    cardSurfaceClass:
      'border-[#2DD4BF]/45 dark:border-[#2DD4BF]/34 bg-gradient-to-b from-[#F0FDFA] via-white to-[#F7FFFD] dark:from-[#14232B] dark:via-[#121F27] dark:to-[#0E1920] hover:border-[#0D9488] dark:hover:border-[#2DD4BF]/70 shadow-[0_6px_18px_rgba(45,212,191,0.13)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.42),0_0_18px_rgba(45,212,191,0.08)]',
    ctaButtonClass:
      'bg-[#0D9488] hover:bg-[#0F766E] dark:bg-[#2DD4BF]/20 dark:hover:bg-[#2DD4BF]/30 dark:border dark:border-[#2DD4BF]/45 text-white dark:text-[#99F6E4]',
  },
  {
    id: 'survival',
    title: 'Desafio Sobrevivência',
    bentoTagline: '3 corações · barra de vida',
    subtitle: 'Survival Mode · ❤️❤️❤️ 3 Vidas',
    description:
      'Sequência progressiva combinando lacunas reais, escuta US/UK livre e tradução contextual para superar seu Recorde Pessoal.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Sobrevivência',
    cardSurfaceClass:
      'border-[#FB7185]/45 dark:border-[#FB7185]/35 bg-gradient-to-b from-[#FFF1F2] via-white to-[#FFF8F9] dark:from-[#26151C] dark:via-[#201218] dark:to-[#190E13] hover:border-[#E11D48] dark:hover:border-[#FB7185]/70 shadow-[0_6px_18px_rgba(251,113,133,0.13)] dark:shadow-[0_10px_26px_rgba(0,0,0,0.42),0_0_18px_rgba(251,113,133,0.09)]',
    ctaButtonClass:
      'bg-[#E11D48] hover:bg-[#BE123C] dark:bg-[#FB7185]/22 dark:hover:bg-[#FB7185]/32 dark:border dark:border-[#FB7185]/48 text-white dark:text-[#FECDD3]',
  },
];

function BentoGameVisualIcon({ id }: { id: MiniGameId }) {
  if (id === 'expression-builder') {
    return (
      <svg
        viewBox="0 0 64 56"
        className="w-14 h-12 sm:w-16 sm:h-14 drop-shadow-[0_4px_10px_rgba(56,189,248,0.22)]"
        aria-hidden="true"
      >
        {/* Top-center & top-right neon emerald blocks */}
        <rect x="24" y="4" width="15" height="14" rx="4" fill="#38E5A5" />
        <rect x="42" y="4" width="15" height="14" rx="4" fill="#10D990" />
        {/* Middle-left amber & middle-right sky-blue blocks */}
        <rect x="7" y="21" width="15" height="14" rx="4" fill="#FBBF24" />
        <rect x="42" y="21" width="15" height="14" rx="4" fill="#38BDF8" />
        {/* Bottom-left coral & bottom-center indigo-blue blocks */}
        <rect x="7" y="38" width="15" height="14" rx="4" fill="#FB7185" />
        <rect x="24" y="38" width="15" height="14" rx="4" fill="#60A5FA" />
      </svg>
    );
  }

  if (id === 'native-ear') {
    return (
      <svg
        viewBox="0 0 72 56"
        className="w-16 h-12 sm:w-[4.5rem] sm:h-14 drop-shadow-[0_4px_12px_rgba(56,229,165,0.28)]"
        aria-hidden="true"
      >
        {/* Outer & inner acoustic wave arcs (left) */}
        <path
          d="M14 14C8.5 21 8.5 35 14 42"
          fill="none"
          stroke="#38E5A5"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M21 19C17.5 24 17.5 32 21 37"
          fill="none"
          stroke="#6EE7B7"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* Golden Lightning Bolt */}
        <path
          d="M39 6L26 30H35L32 50L47 25H37.5L39 6Z"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Inner & outer acoustic wave arcs (right) */}
        <path
          d="M51 19C54.5 24 54.5 32 51 37"
          fill="none"
          stroke="#6EE7B7"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M58 14C63.5 21 63.5 35 58 42"
          fill="none"
          stroke="#38E5A5"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (id === 'lightning-match') {
    return (
      <svg
        viewBox="0 0 64 56"
        className="w-14 h-12 sm:w-16 sm:h-14 drop-shadow-[0_4px_10px_rgba(45,212,191,0.22)]"
        aria-hidden="true"
      >
        {/* 2x2 Paired Memory Tiles */}
        <rect x="9" y="4" width="20" height="20" rx="5.5" fill="#22C55E" />
        <circle cx="19" cy="12" r="3" fill="#ECFDF5" />
        <path d="M14 19.5C14.8 17 23.2 17 24 19.5" stroke="#ECFDF5" strokeWidth="2.2" strokeLinecap="round" />

        <rect x="35" y="4" width="20" height="20" rx="5.5" fill="#8B5CF6" />
        <circle cx="45" cy="12" r="3" fill="#F5F3FF" />
        <path d="M40 19.5C40.8 17 49.2 17 50 19.5" stroke="#F5F3FF" strokeWidth="2.2" strokeLinecap="round" />

        <rect x="9" y="30" width="20" height="20" rx="5.5" fill="#8B5CF6" />
        <circle cx="19" cy="38" r="3" fill="#F5F3FF" />
        <path d="M14 45.5C14.8 43 23.2 43 24 45.5" stroke="#F5F3FF" strokeWidth="2.2" strokeLinecap="round" />

        <rect x="35" y="30" width="20" height="20" rx="5.5" fill="#F59E0B" />
        <circle cx="45" cy="38" r="3" fill="#FFFBEB" />
        <path d="M40 45.5C40.8 43 49.2 43 50 45.5" stroke="#FFFBEB" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 76 56"
      className="w-16 h-12 sm:w-[4.75rem] sm:h-14 drop-shadow-[0_4px_10px_rgba(244,63,94,0.26)]"
      aria-hidden="true"
    >
      {/* 3 Illuminated Ruby Hearts */}
      {[14, 38, 62].map((cx) => (
        <path
          key={cx}
          d={`M${cx} 25C${cx} 25 ${cx - 9} 19 ${cx - 9} 13.2C${cx - 9} 10.2 ${cx - 6.6} 8 ${cx - 4} 8C${cx - 2} 8 ${cx - 0.6} 9.1 ${cx} 10.6C${cx + 0.6} 9.1 ${cx + 2} 8 ${cx + 4} 8C${cx + 6.6} 8 ${cx + 9} 10.2 ${cx + 9} 13.2C${cx + 9} 19 ${cx} 25 ${cx} 25Z`}
          fill="#F43F5E"
        />
      ))}
      {/* Mini Ruby Life Bar Track & Fill */}
      <rect x="6" y="35" width="64" height="10" rx="5" fill="#3B1822" />
      <rect x="7.5" y="36.5" width="38" height="7" rx="3.5" fill="#FB7185" />
    </svg>
  );
}

export const GamesHubView = memo(function GamesHubView({
  allCards,
  question,
  selectedOptionId,
  score,
  totalAnswered,
  defaultOpenQuiz = false,
  stats,
  userDisplayName,
  userEmail,
  currentUid,
  masteredCount,
  reviewCount,
  cloudLeaderboard,
  onSelectOption,
  onNextQuestion,
  onResetScore,
  onCompleteMiniGame,
  onOpenRankingModal,
  onShareQuizAchievement,
}: GamesHubViewProps) {
  const [activeMode, setActiveMode] = useState<ActiveArenaMode>(
    defaultOpenQuiz ? 'quiz' : 'arena'
  );
  const [scopeMode, setScopeMode] =
    useState<ArenaTrainingScopeMode>('review_priority');
  const [scopeCategory, setScopeCategory] = useState<'all' | TopicFolder>('all');
  const [scopeSubtopic, setScopeSubtopic] = useState<'all' | SubtopicKey>('all');

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  const switchArenaMode = useCallback((nextMode: ActiveArenaMode) => {
    stopCurrentAudio();
    void triggerTap();
    setActiveMode(nextMode);
  }, []);

  const { topThree, currentUserEntry } = useMemo(
    () =>
      computeLeaderboard(userDisplayName, stats, {
        currentUid,
        currentUserEmail: userEmail,
        masteredCount,
        reviewCount,
        quizScore: score,
        cloudEntries: cloudLeaderboard,
      }),
    [
      userDisplayName,
      stats,
      currentUid,
      userEmail,
      masteredCount,
      reviewCount,
      score,
      cloudLeaderboard,
    ]
  );

  const reviewPriorityCount = useMemo(
    () =>
      allCards.filter((c) => !c.archived && c.status !== 'mastered').length,
    [allCards]
  );

  const activeCatalogCount = useMemo(
    () => allCards.filter((c) => !c.archived).length,
    [allCards]
  );

  const resolvedPool = useMemo(
    () =>
      resolveMiniGameCardPool(allCards, {
        mode: scopeMode,
        category: scopeCategory,
        subtopic: scopeSubtopic,
      }),
    [allCards, scopeMode, scopeCategory, scopeSubtopic]
  );

  const allNormalizedCards = useMemo(
    () => resolveMiniGameCardPool(allCards, { mode: 'all' }).cards,
    [allCards]
  );

  const dailyXpSnap = useMemo(() => getDailyGamesXpSnapshot(stats), [stats]);
  const survivalBestStreak = Math.max(0, Math.floor(stats.survivalBestStreak || 0));
  const monthName = getMonthNamePt();

  if (activeMode === 'quiz') {
    return (
      <div className="ewm-pillar-enter space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => switchArenaMode('arena')}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DFDBD0] dark:border-[#2E3630] bg-white dark:bg-[#1F2420] text-xs font-semibold text-[#5C574E] dark:text-[#C8D0CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar à Arena de Jogos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void triggerTap();
              onOpenRankingModal();
            }}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EAD9B8] dark:border-[#4A3B22] bg-[#FFFDF8] dark:bg-[#241F17] text-xs font-semibold text-[#B45309] dark:text-[#FBBF24] cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-mono-num">
              {currentUserEntry.rank > 0
                ? `#${currentUserEntry.rank} · ${currentUserEntry.score} XP`
                : 'Ver Ranking Mensal'}
            </span>
          </button>
        </div>

        <QuizView
          question={question}
          selectedOptionId={selectedOptionId}
          score={score}
          totalAnswered={totalAnswered}
          onSelectOption={onSelectOption}
          onNextQuestion={onNextQuestion}
          onResetScore={onResetScore}
          onShareQuizAchievement={onShareQuizAchievement}
        />
      </div>
    );
  }

  if (activeMode === 'expression-builder') {
    return (
      <ExpressionBuilderGame
        pool={resolvedPool.cards}
        dailyCapReached={dailyXpSnap.capReached}
        onCompleteMatch={onCompleteMiniGame}
        onBackToArena={() => switchArenaMode('arena')}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  if (activeMode === 'native-ear') {
    return (
      <NativeEarGame
        pool={resolvedPool.cards}
        allReferenceCards={allNormalizedCards}
        dailyCapReached={dailyXpSnap.capReached}
        onCompleteMatch={onCompleteMiniGame}
        onBackToArena={() => switchArenaMode('arena')}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  if (activeMode === 'lightning-match') {
    return (
      <LightningMatchGame
        pool={resolvedPool.cards}
        allReferenceCards={allNormalizedCards}
        dailyCapReached={dailyXpSnap.capReached}
        onCompleteMatch={onCompleteMiniGame}
        onBackToArena={() => switchArenaMode('arena')}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  if (activeMode === 'survival') {
    return (
      <SurvivalChallengeGame
        pool={resolvedPool.cards}
        allReferenceCards={allNormalizedCards}
        savedBestStreak={survivalBestStreak}
        dailyCapReached={dailyXpSnap.capReached}
        onCompleteMatch={onCompleteMiniGame}
        onBackToArena={() => switchArenaMode('arena')}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  const xpProgressPercent = Math.min(
    100,
    Math.round((dailyXpSnap.todayEarnedXp / dailyXpSnap.capLimit) * 100)
  );
  const rankProgressPercent = Math.min(
    100,
    Math.max(16, Math.round(((currentUserEntry.score % 500) / 500) * 100))
  );
  const rankBadgeText =
    currentUserEntry.rank > 0
      ? `${currentUserEntry.rank}º lugar`
      : 'Em estreia';

  return (
    <div className="ewm-pillar-enter space-y-5 sm:space-y-6">
      {/* 1. Top Ranking & XP Neon Banner + Training Scope Filter */}
      <section
        aria-label="Posição no Ranking, XP diário e escopo da Arena"
        className="rounded-3xl border border-[#10D990]/32 dark:border-[#38E5A5]/26 bg-white dark:bg-[#141C24] p-4 sm:p-5 shadow-[0_6px_20px_rgba(16,217,144,0.14)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.48),0_0_22px_rgba(56,229,165,0.08)] space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm sm:text-base font-display font-bold text-[#0F172A] dark:text-[#F4F8F6]">
            <span>Sua Posição:</span>
            <span className="text-[#00A86E] dark:text-[#38E5A5]">
              {rankBadgeText}
            </span>
            <span className="text-[#64748B] dark:text-[#64748B]">·</span>
            <span className="font-mono-num text-[#D97706] dark:text-[#FBBF24]">
              {currentUserEntry.score} XP
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dailyXpSnap.capReached ? (
              <span
                data-testid="arena-daily-cap-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#10D990]/35 dark:border-[#38E5A5]/30 bg-[#ECFDF5] dark:bg-[#162922] text-[11px] font-semibold text-[#047857] dark:text-[#6EE7B7]"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{ARENA_FREE_TRAINING_BADGE_PT}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono-num text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-xl bg-[#EFFAF5] dark:bg-[#182722] border border-[#10D990]/30 dark:border-[#38E5A5]/25 text-[#047857] dark:text-[#38E5A5]">
                <Zap className="w-3.5 h-3.5 fill-current text-[#F59E0B] dark:text-[#FBBF24]" />
                <span>
                  Hoje: {dailyXpSnap.todayEarnedXp}/{dailyXpSnap.capLimit} XP
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                void triggerTap();
                onOpenRankingModal();
              }}
              className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#F59E0B]/35 dark:border-[#FBBF24]/30 bg-[#FFFBEB] hover:bg-[#FEF3C7] dark:bg-[#272015] dark:hover:bg-[#33291A] text-[11px] font-bold text-[#B45309] dark:text-[#FBBF24] cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Pódio</span>
            </button>
          </div>
        </div>

        {/* Neon-Green Progress Track with Golden Lightning Bolt */}
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex-1 h-2.5 rounded-full bg-[#E6F2ED] dark:bg-[#1E2A36] overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00C982] to-[#10D990] dark:from-[#10D990] dark:to-[#38E5A5] ewm-neon-progress transition-all duration-500"
              style={{
                width: `${
                  dailyXpSnap.todayEarnedXp > 0
                    ? Math.max(18, xpProgressPercent)
                    : rankProgressPercent
                }%`,
              }}
            />
          </div>
          <Zap
            aria-hidden="true"
            className="w-4 h-4 shrink-0 fill-[#FBBF24] text-[#F59E0B] drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]"
          />
        </div>

        {/* Main Scope Pills */}
        <div
          role="group"
          aria-label="Selecionar conjunto de cards para os mini-games"
          className="flex flex-wrap items-center gap-1.5 pt-0.5"
        >
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setScopeMode('review_priority');
            }}
            aria-pressed={scopeMode === 'review_priority'}
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              scopeMode === 'review_priority'
                ? 'border-[#00C982] dark:border-[#38E5A5]/65 bg-[#00A86E] dark:bg-[#38E5A5]/18 text-white dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.22)]'
                : 'border-[#DCEAE4] dark:border-[#253341] bg-[#F6FBF9] dark:bg-[#1B2531] text-[#334155] dark:text-[#B8C7D4] hover:border-[#00C982]/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Para Revisar</span>
            <span className="font-mono-num text-[11px] opacity-85">
              ({reviewPriorityCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setScopeMode('all');
            }}
            aria-pressed={scopeMode === 'all'}
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              scopeMode === 'all'
                ? 'border-[#00C982] dark:border-[#38E5A5]/65 bg-[#00A86E] dark:bg-[#38E5A5]/18 text-white dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.22)]'
                : 'border-[#DCEAE4] dark:border-[#253341] bg-[#F6FBF9] dark:bg-[#1B2531] text-[#334155] dark:text-[#B8C7D4] hover:border-[#00C982]/50'
            }`}
          >
            <span>Acervo Completo EWM</span>
            <span className="font-mono-num text-[11px] opacity-85">
              ({activeCatalogCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setScopeMode('topic');
            }}
            aria-pressed={scopeMode === 'topic'}
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              scopeMode === 'topic'
                ? 'border-[#00C982] dark:border-[#38E5A5]/65 bg-[#00A86E] dark:bg-[#38E5A5]/18 text-white dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.22)]'
                : 'border-[#DCEAE4] dark:border-[#253341] bg-[#F6FBF9] dark:bg-[#1B2531] text-[#334155] dark:text-[#B8C7D4] hover:border-[#00C982]/50'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Por Pasta / Subtópico</span>
          </button>
        </div>

        {/* Folder & Subtopic Secondary Pills when 'topic' is selected */}
        {scopeMode === 'topic' && (
          <div className="pt-2 border-t border-[#E2EFEA] dark:border-[#23303D] space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#475569] dark:text-[#94A3B8] mr-1">
                Pasta:
              </span>
              {(['all', ...VALID_FOLDERS] as const).map((folder) => {
                const active = scopeCategory === folder;
                return (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => {
                      void triggerTap();
                      setScopeCategory(folder);
                    }}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'border-[#00C982] dark:border-[#38E5A5] bg-[#ECFDF5] dark:bg-[#173028] text-[#047857] dark:text-[#38E5A5]'
                        : 'border-[#DCEAE4] dark:border-[#263442] bg-white dark:bg-[#1B2531] text-[#475569] dark:text-[#B8C7D4]'
                    }`}
                  >
                    {folder === 'all' ? 'Todas as Pastas' : folder}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#475569] dark:text-[#94A3B8] mr-1">
                Subtópico:
              </span>
              {(
                [
                  { key: 'all' as const, label: 'Todos os Subtópicos' },
                  ...VALID_SUBTOPICS,
                ] as const
              ).map((sub) => {
                const active = scopeSubtopic === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => {
                      void triggerTap();
                      setScopeSubtopic(sub.key);
                    }}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'border-[#00C982] dark:border-[#38E5A5] bg-[#ECFDF5] dark:bg-[#173028] text-[#047857] dark:text-[#38E5A5]'
                        : 'border-[#DCEAE4] dark:border-[#263442] bg-white dark:bg-[#1B2531] text-[#475569] dark:text-[#B8C7D4]'
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Graceful Fallback Volume Notice */}
        {resolvedPool.usedFallback && resolvedPool.fallbackNoticePt && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-[#F59E0B]/35 dark:border-[#FBBF24]/30 bg-[#FFFBEB] dark:bg-[#251F14] px-3 py-2 text-[11.5px] text-[#92400E] dark:text-[#FCD34D]"
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{resolvedPool.fallbackNoticePt}</span>
          </div>
        )}
      </section>

      {/* 2. 2x2 Bento Grid — 4 Active Pedagogical Mini-Games */}
      <section aria-labelledby="ewm-arena-games-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <h3
            id="ewm-arena-games-heading"
            className="font-display text-xs sm:text-sm font-semibold text-[#475569] dark:text-[#9FB0BF]"
          >
            Destaques · 4 Modos Rápidos ({resolvedPool.cards.length} cards prontos)
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {ARENA_MINI_GAMES.map((game) => {
            const isSurvival = game.id === 'survival';

            return (
              <article
                key={game.id}
                data-testid={`arena-card-${game.id}`}
                onClick={() => switchArenaMode(game.id)}
                className={`rounded-3xl border p-4 sm:p-5 flex flex-col items-center text-center justify-between gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 ${game.cardSurfaceClass}`}
              >
                {/* Top XP / Record Badges */}
                <div className="w-full flex flex-wrap items-center justify-between gap-1">
                  <span className="font-mono-num text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-[#E2E8F0]">
                    {game.xpBadge}
                  </span>

                  {isSurvival && (
                    <span
                      data-testid="arena-survival-best-streak"
                      className="inline-flex items-center gap-1 font-mono-num text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFE4E6] dark:bg-[#3B1824] text-[#BE123C] dark:text-[#FDA4AF]"
                    >
                      <Flame className="w-3 h-3 fill-current" />
                      <span>Rec: {survivalBestStreak}</span>
                    </span>
                  )}
                </div>

                {/* Bespoke Bento Visual Artwork */}
                <div className="py-1 flex items-center justify-center">
                  <BentoGameVisualIcon id={game.id} />
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-1">
                  <h4 className="font-display text-sm sm:text-lg font-bold leading-tight text-[#0F172A] dark:text-[#F8FAFC]">
                    {game.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                    {game.bentoTagline}
                  </p>
                  <p className="hidden sm:block text-xs text-[#475569] dark:text-[#9FB0BF] leading-relaxed pt-1">
                    {game.description}
                  </p>
                </div>

                {/* Launch Action Pill */}
                <button
                  type="button"
                  data-testid={`arena-launch-${game.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    switchArenaMode(game.id);
                  }}
                  className={`w-full min-h-[38px] sm:min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${game.ctaButtonClass}`}
                >
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="truncate">{game.ctaLabel}</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Classic Modo Quiz + Monthly Podium Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Modo Quiz (Featured Hero Card) */}
        <div className="lg:col-span-7 rounded-3xl border border-[#10D990]/35 dark:border-[#38E5A5]/30 bg-gradient-to-br from-white via-[#F4FBF8] to-[#E8F8F1] dark:from-[#142029] dark:via-[#121D24] dark:to-[#10241E] p-5 sm:p-6 shadow-[0_4px_18px_rgba(16,217,144,0.12)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.42)] flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00A86E] dark:bg-[#38E5A5]/20 text-white dark:text-[#38E5A5] text-[11px] font-bold tracking-wide uppercase">
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Clássico EWM</span>
              </span>

              <span className="inline-flex items-center gap-1 font-mono-num text-xs font-bold text-[#047857] dark:text-[#38E5A5]">
                <Zap className="w-3.5 h-3.5 fill-current text-[#F59E0B] dark:text-[#FBBF24]" />
                <span>+15 XP por acerto</span>
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#00A86E] dark:bg-[#19382E] text-white dark:text-[#38E5A5] flex items-center justify-center shrink-0 shadow-2xs">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F4F8F6]">
                  Modo Quiz · Desafio Rápido US &amp; UK
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] dark:text-[#A8BAC8] leading-relaxed mt-0.5">
                  Teste seu domínio das traduções coloquiais reais, ouça cada expressão nos sotaques Americano e Britânico e suba no Ranking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D1EAE0] dark:border-[#223631]">
            <div className="font-mono-num text-xs text-[#475569] dark:text-[#9FB0BF]">
              Placar atual:{' '}
              <strong className="text-[#0F172A] dark:text-[#F4F8F6] font-bold">
                {score} / {totalAnswered}
              </strong>{' '}
              acertos
            </div>

            <button
              type="button"
              onClick={() => switchArenaMode('quiz')}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00A86E] hover:bg-[#008F5D] dark:bg-[#38E5A5] dark:hover:bg-[#2AD192] text-white dark:text-[#071711] text-xs sm:text-sm font-bold shadow-[0_4px_14px_rgba(16,217,144,0.28)] cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{totalAnswered > 0 ? 'Continuar Quiz' : 'Jogar Modo Quiz'}</span>
            </button>
          </div>
        </div>

        {/* Right: Integrated Real Monthly Ranking Card */}
        <div className="lg:col-span-5 rounded-3xl border border-[#F59E0B]/32 dark:border-[#FBBF24]/25 bg-white dark:bg-[#171B22] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309] dark:text-[#FBBF24]">
                <Trophy className="w-4 h-4" />
                <span>Ranking EWM · {monthName}</span>
              </span>

              <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-lg bg-[#FEF3C7] dark:bg-[#332814] text-[#92400E] dark:text-[#FDE68A]">
                {currentUserEntry.score} XP
              </span>
            </div>

            {topThree.length > 0 ? (
              <div className="space-y-1.5">
                {topThree.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
                      student.isCurrentUser
                        ? 'border-[#00C982]/45 dark:border-[#38E5A5]/38 bg-[#ECFDF5] dark:bg-[#162B24]'
                        : 'border-[#E2E8F0] dark:border-[#252E3A] bg-[#F8FAFC] dark:bg-[#1E2530]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{student.badgeEmoji}</span>
                      <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9] truncate">
                        {student.shortName}
                        {student.isCurrentUser ? ' (Você)' : ''}
                      </span>
                    </div>
                    <span className="font-mono-num font-bold text-[#047857] dark:text-[#38E5A5] shrink-0">
                      {student.score} XP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E2D6BE] dark:border-[#363126] bg-[#FFFDF8] dark:bg-[#1E1C18] p-3.5 text-center space-y-1">
                <p className="text-xs font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  Seja o primeiro aluno no Ranking!
                </p>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  Pratique cards, jogue na Arena ou acerte questões no Modo Quiz para estrear o pódio de {monthName}.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              void triggerTap();
              onOpenRankingModal();
            }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl border border-[#F59E0B]/35 dark:border-[#FBBF24]/30 bg-[#FFFBEB] hover:bg-[#FEF3C7] dark:bg-[#262015] dark:hover:bg-[#322A1B] text-xs font-semibold text-[#92400E] dark:text-[#FBBF24] cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Abrir Pódio &amp; Estatísticas Completas</span>
          </button>
        </div>
      </div>
    </div>
  );
});
