import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Blocks,
  Ear,
  Filter,
  Flame,
  FolderOpen,
  Gamepad2,
  Grid2x2Check,
  Heart,
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
  subtitle: string;
  description: string;
  xpBadge: string;
  ctaLabel: string;
  icon: typeof Blocks;
}

const ARENA_MINI_GAMES: readonly ArenaGameDescriptor[] = [
  {
    id: 'expression-builder',
    title: 'Monte a Expressão',
    subtitle: 'Expression / Sentence Builder',
    description:
      'Ordene sintagmas e palavras reais em inglês a partir da tradução natural em português, com dica sonora US/UK e zero falsos negativos.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Montar Frases',
    icon: Blocks,
  },
  {
    id: 'native-ear',
    title: 'Ouvido de Nativo',
    subtitle: 'Native Ear Sprint · US & UK',
    description:
      '8 rodadas de compreensão auditiva pura (12s por questão) alternando vozes neurais Americanas, Britânicas ou Misto Realista.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Treinar Escuta',
    icon: Ear,
  },
  {
    id: 'lightning-match',
    title: 'Memória Relâmpago',
    subtitle: 'Lightning Match · Colunas Rápidas',
    description:
      'Conecte expressões em inglês ao equivalente natural do Brasil em duas colunas dinâmicas com dissolução suave e reposição contínua.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Conectar Pares',
    icon: Grid2x2Check,
  },
  {
    id: 'survival',
    title: 'Desafio Sobrevivência',
    subtitle: 'Survival Mode · ❤️❤️❤️ 3 Vidas',
    description:
      'Sequência progressiva combinando lacunas em frases reais, escuta rápida e tradução contextual para superar seu Recorde Pessoal.',
    xpBadge: '+8 a +18 XP',
    ctaLabel: 'Iniciar Sobrevivência',
    icon: Heart,
  },
];

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

  return (
    <div className="ewm-pillar-enter space-y-5 sm:space-y-6">
      {/* Top Scope Filter + Daily Anti-Farming XP Status */}
      <section
        aria-label="Escopo de treino e XP diário da Arena"
        className="rounded-3xl border border-[#DFDBD0] dark:border-[#2C342E] bg-white/95 dark:bg-[#1C211D] p-4 sm:p-5 shadow-2xs space-y-3.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#192D27] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-xs sm:text-sm font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                Escopo de Treino da Arena
              </h2>
              <p className="text-[11px] text-[#6B655C] dark:text-[#9CA59E]">
                Escolha com quais cards reais EWM deseja jogar nas partidas abaixo
              </p>
            </div>
          </div>

          {/* Daily Arena XP Meter / Free Training Badge */}
          <div className="flex flex-col sm:items-end gap-1">
            {dailyXpSnap.capReached ? (
              <span
                data-testid="arena-daily-cap-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#C6DBD7] dark:border-[#2C473F] bg-[#F2F8F6] dark:bg-[#192823] text-[11px] font-semibold text-[#225851] dark:text-[#68B4A8]"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{ARENA_FREE_TRAINING_BADGE_PT}</span>
              </span>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1 font-mono-num text-xs font-bold text-[#225851] dark:text-[#38E5A5]">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>
                    XP da Arena hoje: {dailyXpSnap.todayEarnedXp} / {dailyXpSnap.capLimit} XP
                  </span>
                </span>
                <div
                  aria-hidden="true"
                  className="w-20 h-2 rounded-full bg-[#ECE8DF] dark:bg-[#2A312C] overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-[#28665E] dark:bg-[#38E5A5] transition-all duration-300"
                    style={{ width: `${xpProgressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Scope Pills */}
        <div
          role="group"
          aria-label="Selecionar conjunto de cards para os mini-games"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setScopeMode('review_priority');
            }}
            aria-pressed={scopeMode === 'review_priority'}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              scopeMode === 'review_priority'
                ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#28665E] dark:bg-[#23534A] text-white'
                : 'border-[#DFDBD0] dark:border-[#2E3630] bg-[#FAF9F5] dark:bg-[#222824] text-[#524E46] dark:text-[#C5CEC8] hover:border-[#28665E]/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Para Revisar (Prioridade)</span>
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
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              scopeMode === 'all'
                ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#28665E] dark:bg-[#23534A] text-white'
                : 'border-[#DFDBD0] dark:border-[#2E3630] bg-[#FAF9F5] dark:bg-[#222824] text-[#524E46] dark:text-[#C5CEC8] hover:border-[#28665E]/50'
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
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              scopeMode === 'topic'
                ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#28665E] dark:bg-[#23534A] text-white'
                : 'border-[#DFDBD0] dark:border-[#2E3630] bg-[#FAF9F5] dark:bg-[#222824] text-[#524E46] dark:text-[#C5CEC8] hover:border-[#28665E]/50'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Por Pasta / Subtópico</span>
          </button>
        </div>

        {/* Folder & Subtopic Secondary Pills when 'topic' is selected */}
        {scopeMode === 'topic' && (
          <div className="pt-2 border-t border-[#ECE8DF] dark:border-[#2A312C] space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B655C] dark:text-[#9CA59E] mr-1">
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
                        ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#EAF3F1] dark:bg-[#1B332C] text-[#1D4E48] dark:text-[#38E5A5]'
                        : 'border-[#E4E0D8] dark:border-[#2D352F] bg-white dark:bg-[#222723] text-[#5C574E] dark:text-[#B5BEB7]'
                    }`}
                  >
                    {folder === 'all' ? 'Todas as Pastas' : folder}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B655C] dark:text-[#9CA59E] mr-1">
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
                        ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#EAF3F1] dark:bg-[#1B332C] text-[#1D4E48] dark:text-[#38E5A5]'
                        : 'border-[#E4E0D8] dark:border-[#2D352F] bg-white dark:bg-[#222723] text-[#5C574E] dark:text-[#B5BEB7]'
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
            className="flex items-start gap-2 rounded-2xl border border-[#E5D3B0] dark:border-[#463922] bg-[#FFFDF7] dark:bg-[#252016] px-3 py-2 text-[11.5px] text-[#7C5816] dark:text-[#FCD34D]"
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{resolvedPool.fallbackNoticePt}</span>
          </div>
        )}
      </section>

      {/* Featured Row: Modo Quiz + Live Monthly Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Modo Quiz (Featured Hero Card) */}
        <div className="lg:col-span-7 rounded-3xl border border-[#C6DBD7] dark:border-[#38E5A5]/35 bg-gradient-to-br from-white via-[#F6FBF9] to-[#EAF3F1] dark:from-[#1B2420] dark:via-[#18221E] dark:to-[#142721] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#28665E] dark:bg-[#38E5A5]/20 text-white dark:text-[#38E5A5] text-[11px] font-bold tracking-wide uppercase">
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Clássico EWM</span>
              </span>

              <span className="inline-flex items-center gap-1 font-mono-num text-xs font-bold text-[#225851] dark:text-[#68B4A8]">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>+15 XP por acerto</span>
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#28665E] dark:bg-[#24473E] text-white dark:text-[#38E5A5] flex items-center justify-center shrink-0 shadow-2xs">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                  Modo Quiz · Desafio Rápido US &amp; UK
                </h3>
                <p className="text-xs sm:text-sm text-[#524E46] dark:text-[#B5C0B9] leading-relaxed mt-0.5">
                  Teste seu domínio das traduções coloquiais reais, ouça cada expressão nos sotaques Americano e Britânico e suba no Ranking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D3E3DF] dark:border-[#293D36]">
            <div className="font-mono-num text-xs text-[#524E46] dark:text-[#AEBAB2]">
              Placar atual:{' '}
              <strong className="text-[#1C1B18] dark:text-[#F4F7F6] font-bold">
                {score} / {totalAnswered}
              </strong>{' '}
              acertos
            </div>

            <button
              type="button"
              onClick={() => switchArenaMode('quiz')}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{totalAnswered > 0 ? 'Continuar Quiz' : 'Jogar Modo Quiz'}</span>
            </button>
          </div>
        </div>

        {/* Right: Integrated Real Monthly Ranking Card */}
        <div className="lg:col-span-5 rounded-3xl border border-[#EAD9B8] dark:border-[#3D3320] bg-white dark:bg-[#1E1D19] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309] dark:text-[#FBBF24]">
                <Trophy className="w-4 h-4" />
                <span>Ranking EWM · {monthName}</span>
              </span>

              <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-lg bg-[#FEF3C7] dark:bg-[#362B16] text-[#92400E] dark:text-[#FDE68A]">
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
                        ? 'border-[#28665E]/40 dark:border-[#38E5A5]/35 bg-[#EAF3F1]/70 dark:bg-[#1A2B26]'
                        : 'border-[#ECE8DF] dark:border-[#2C2A24] bg-[#FAF9F6] dark:bg-[#25241F]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{student.badgeEmoji}</span>
                      <span className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                        {student.shortName}
                        {student.isCurrentUser ? ' (Você)' : ''}
                      </span>
                    </div>
                    <span className="font-mono-num font-bold text-[#28665E] dark:text-[#68B4A8] shrink-0">
                      {student.score} XP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E2D6BE] dark:border-[#3B3425] bg-[#FAF8F3] dark:bg-[#24211B] p-3.5 text-center space-y-1">
                <p className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                  Seja o primeiro aluno no Ranking!
                </p>
                <p className="text-[11px] text-[#6B655C] dark:text-[#A49F95]">
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
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl border border-[#E5D3B0] dark:border-[#4A3B22] bg-[#FFFDF8] hover:bg-[#FEF7E6] dark:bg-[#282218] dark:hover:bg-[#322A1E] text-xs font-semibold text-[#92400E] dark:text-[#FBBF24] cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Abrir Pódio &amp; Estatísticas Completas</span>
          </button>
        </div>
      </div>

      {/* 4 Active Pedagogical Mini-Games */}
      <section aria-labelledby="ewm-arena-games-heading" className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div>
            <h3
              id="ewm-arena-games-heading"
              className="font-display text-sm sm:text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
            >
              Mini-Games Pedagógicos EWM (4 Modos Ativos)
            </h3>
            <p className="text-xs text-[#6B655C] dark:text-[#A0A8A2]">
              Treinos rápidos de sintaxe, escuta nativa, conexão lexical e sobrevivência alimentados pelo seu escopo selecionado ({resolvedPool.cards.length} cards prontos).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ARENA_MINI_GAMES.map((game) => {
            const Icon = game.icon;
            const isSurvival = game.id === 'survival';

            return (
              <article
                key={game.id}
                data-testid={`arena-card-${game.id}`}
                className="rounded-2xl border border-[#DCD7CC] dark:border-[#2C352F] bg-white dark:bg-[#1D221E] hover:border-[#28665E]/55 dark:hover:border-[#38E5A5]/45 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-[#EAF3F1] dark:bg-[#1E332D] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {isSurvival && (
                        <span
                          data-testid="arena-survival-best-streak"
                          className="inline-flex items-center gap-1 font-mono-num text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#FEF3C7] dark:bg-[#332713] text-[#B45309] dark:text-[#FBBF24]"
                        >
                          <Flame className="w-3 h-3 fill-current" />
                          <span>Recorde: {survivalBestStreak}</span>
                        </span>
                      )}

                      <span className="font-mono-num text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#192B26] text-[#225851] dark:text-[#68B4A8]">
                        {game.xpBadge}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                      {game.title}
                    </h4>
                    <p className="text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8]">
                      {game.subtitle}
                    </p>
                    <p className="text-xs text-[#5C574E] dark:text-[#A6B0A9] leading-relaxed mt-1.5">
                      {game.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#ECE8DF] dark:border-[#28302B] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#6B655C] dark:text-[#98A29B]">
                    {isSurvival ? '3 vidas · Combo progressivo' : 'Áudio US/UK integrado'}
                  </span>

                  <button
                    type="button"
                    data-testid={`arena-launch-${game.id}`}
                    onClick={() => switchArenaMode(game.id)}
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#255D54] dark:hover:bg-[#2E7066] text-white text-xs font-semibold shadow-2xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{game.ctaLabel}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
});
