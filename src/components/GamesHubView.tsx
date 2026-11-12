import { memo, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Blocks,
  Ear,
  Gamepad2,
  Grid2x2Check,
  HelpCircle,
  Lock,
  MessageSquareText,
  Play,
  Trophy,
  Zap,
} from 'lucide-react';
import type { Flashcard, QuizOption, QuizQuestion } from '../types/flashcard';
import {
  computeLeaderboard,
  getMonthNamePt,
  type CloudLeaderboardRecord,
  type UserStudyStats,
} from '../utils/studyMetrics';
import { triggerTap } from '../services/platform/hapticsService';
import { QuizView } from './QuizView';

interface GamesHubViewProps {
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
  onOpenRankingModal: () => void;
  onShareQuizAchievement?: (featuredCard: Flashcard | null) => void;
}

const UPCOMING_MINI_GAMES = [
  {
    id: 'sentence-builder',
    title: 'Sentence Builder',
    subtitle: 'Monte a Frase Nativa',
    description:
      'Ordene blocos reais de conversação para dominar a estrutura natural do inglês sem traduzir palavra por palavra.',
    xpBadge: '+20 XP',
    icon: Blocks,
  },
  {
    id: 'listening-sprint',
    title: 'Listening Sprint US & UK',
    subtitle: 'Desafio de Escuta Rápida',
    description:
      'Ouça falantes nativos americanos e britânicos em velocidade real e identifique a expressão exata.',
    xpBadge: '+20 XP',
    icon: Ear,
  },
  {
    id: 'colloquial-match',
    title: 'Memory Match Coloquial',
    subtitle: 'Conexão Instantânea',
    description:
      'Conecte phrasal verbs e expressões idiomáticas ao equivalente natural usado no Brasil contra o relógio.',
    xpBadge: '+25 XP',
    icon: Grid2x2Check,
  },
  {
    id: 'context-fill',
    title: 'Fill the Gap Contextual',
    subtitle: 'Complete o Diálogo Real',
    description:
      'Escolha a collocation ou expressão perfeita para destravar situações de viagem, trabalho e conversa casual.',
    xpBadge: '+20 XP',
    icon: MessageSquareText,
  },
] as const;

export const GamesHubView = memo(function GamesHubView({
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
  onOpenRankingModal,
  onShareQuizAchievement,
}: GamesHubViewProps) {
  const [playingQuiz, setPlayingQuiz] = useState<boolean>(defaultOpenQuiz);

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

  const monthName = getMonthNamePt();

  if (playingQuiz) {
    return (
      <div className="ewm-pillar-enter space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setPlayingQuiz(false);
            }}
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

  return (
    <div className="ewm-pillar-enter space-y-5 sm:space-y-6">
      {/* Header + Live Ranking Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Functional Game #1 — Modo Quiz (Featured Hero Card) */}
        <div className="lg:col-span-7 rounded-3xl border border-[#C6DBD7] dark:border-[#38E5A5]/35 bg-gradient-to-br from-white via-[#F6FBF9] to-[#EAF3F1] dark:from-[#1B2420] dark:via-[#18221E] dark:to-[#142721] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#28665E] dark:bg-[#38E5A5]/20 text-white dark:text-[#38E5A5] text-[11px] font-bold tracking-wide uppercase">
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Jogo Ativo #1</span>
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
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                  Modo Quiz · Desafio Rápido US &amp; UK
                </h2>
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
              onClick={() => {
                void triggerTap();
                setPlayingQuiz(true);
              }}
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
                  Pratique cards ou acerte questões no Modo Quiz para estrear o pódio de {monthName}.
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

      {/* 4 Upcoming Mini-Games Cards Prepared for Activation */}
      <section aria-labelledby="ewm-upcoming-games-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div>
            <h3
              id="ewm-upcoming-games-heading"
              className="font-display text-sm sm:text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
            >
              Novos Mini-Games EWM (4 Modos Preparados)
            </h3>
            <p className="text-xs text-[#6B655C] dark:text-[#A0A8A2]">
              Prontos na arquitetura para ativação nas próximas camadas de gamificação pedagógica.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {UPCOMING_MINI_GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <article
                key={game.id}
                className="rounded-2xl border border-[#E4E0D8] dark:border-[#2A312B] bg-white/90 dark:bg-[#1D221E] p-4 sm:p-5 flex flex-col justify-between gap-3 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#F0EDE6] dark:bg-[#262D28] text-[#28665E] dark:text-[#68B4A8] flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-num text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#192B26] text-[#225851] dark:text-[#68B4A8]">
                        {game.xpBadge}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-[#F0EDE6] dark:bg-[#262B27] text-[#6B655C] dark:text-[#9CA49E]">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Em breve</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-display text-sm sm:text-[15px] font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                      {game.title}
                    </h4>
                    <p className="text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8]">
                      {game.subtitle}
                    </p>
                    <p className="text-xs text-[#6B655C] dark:text-[#9FA7A1] leading-relaxed mt-1">
                      {game.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
});
