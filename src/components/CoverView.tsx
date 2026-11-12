import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  LogOut,
  Moon,
  Shield,
  Sun,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { AppTab, SyncStatus, ThemeMode } from '../types/flashcard';
import {
  computeProgressMetrics,
  formatStudentFirstName,
} from '../utils/coverHelpers';
import { TopStudentsCoverPodium } from './TopStudentsCoverPodium';
import { MonthlyRankingModal } from './MonthlyRankingModal';
import { PWAInstallButton } from './PWAInstallButton';
import type { UserStudyStats } from '../utils/studyMetrics';

const TEACHER_MARIANA_PORTRAIT_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-08_at_14.38.24_7c01daed.jpeg';

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    percentage: number;
    color: string;
  };
}

function CustomProgressTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] px-3 py-1.5 shadow-md text-xs text-[#1C1B18] dark:text-[#EBE7DE]">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-semibold">{item.name}:</span>
          <span className="font-mono-num font-bold">
            {item.value} ({item.percentage}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
}

interface CoverViewProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  totalCards: number;
  masteredCount: number;
  reviewCount?: number;
  unseenCount?: number;
  decksCount: number;
  syncStatus: SyncStatus;
  userDisplayName: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  isSigningIn: boolean;
  stats: UserStudyStats;
  onUpdateGoal: (newGoal: number) => void;
  onSignInAndEnter: () => void;
  onSignOut: () => void;
  onEnterApp: (targetTab?: AppTab) => void;
  onOpenAdminPanel: () => void;
  onOpenPhoneticGuide: () => void;
}

export function CoverView({
  theme,
  onToggleTheme,
  totalCards,
  masteredCount,
  reviewCount = 0,
  unseenCount,
  decksCount,
  syncStatus,
  userDisplayName,
  userEmail,
  isAdmin,
  isSigningIn,
  stats,
  onUpdateGoal,
  onSignInAndEnter,
  onSignOut,
  onEnterApp,
  onOpenAdminPanel,
  onOpenPhoneticGuide,
}: CoverViewProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [rankingModalOpen, setRankingModalOpen] = useState(false);

  const isLoggedIn = Boolean(userEmail || userDisplayName);
  const firstName = formatStudentFirstName(userDisplayName, userEmail);
  const progress = computeProgressMetrics(
    totalCards,
    masteredCount,
    reviewCount,
    unseenCount
  );

  const chartData = [
    {
      name: 'Dominados',
      value: progress.mastered,
      percentage: progress.masteredPercentage,
      color: theme === 'dark' ? '#357F74' : '#28665E',
    },
    {
      name: 'Em revisão',
      value: progress.review,
      percentage: progress.reviewPercentage,
      color: theme === 'dark' ? '#D98826' : '#D97706',
    },
    {
      name: 'Não vistos',
      value: progress.unseen,
      percentage: progress.unseenPercentage,
      color: theme === 'dark' ? '#383D37' : '#D5D0C5',
    },
  ];

  const activeSlices = chartData.filter((d) => d.value > 0);
  const displayChartData =
    activeSlices.length > 0
      ? activeSlices
      : [
          {
            name: 'Não vistos',
            value: 1,
            percentage: 100,
            color: theme === 'dark' ? '#383D37' : '#D5D0C5',
          },
        ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F4EF] dark:bg-[#181A18] text-[#1C1B18] dark:text-[#EBE7DE] transition-colors relative">
      {/* Full Monthly Ranking & Personal Metrics Modal */}
      <MonthlyRankingModal
        isOpen={rankingModalOpen}
        onClose={() => setRankingModalOpen(false)}
        stats={stats}
        userDisplayName={userDisplayName}
        onUpdateGoal={onUpdateGoal}
      />

      {/* Strict 3-Zone Top Bar Contract with Docked Live Ranking */}
      <header className="ios-safe-header border-b border-[#E4E0D8] dark:border-[#2E332E] bg-[#F6F4EF]/90 dark:bg-[#181A18]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-6">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#capa-inicio"
            className="font-display text-base sm:text-lg font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE] whitespace-nowrap shrink-0"
          >
            <span className="sm:hidden">EWM</span>
            <span className="hidden sm:inline">EWM · Keep practicing</span>
          </a>

          {/* Zone 2: clean single-line text navigation links */}
          <nav
            aria-label="Navegação da capa"
            className="hidden lg:flex items-center gap-5 xl:gap-7 text-sm font-medium text-[#5C574E] dark:text-[#AFAAA0]"
          >
            <a
              href="#metodo-ewm"
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Método EWM
            </a>
            <button
              type="button"
              onClick={() => onEnterApp('decks')}
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Baralhos
            </button>
            <button
              type="button"
              onClick={() => onEnterApp('quiz')}
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Modo Quiz
            </button>
            <button
              type="button"
              onClick={() => onEnterApp('list')}
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Acervo Completo
            </button>
          </nav>

          {/* Zone 3: Live Ranking Button (between Acervo Completo and Praticar agora) + Primary Action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <TopStudentsCoverPodium
              stats={stats}
              userDisplayName={userDisplayName}
              onOpenRankingModal={() => setRankingModalOpen(true)}
            />

            <button
              type="button"
              onClick={() => onEnterApp('study')}
              title={isLoggedIn ? 'Ir para os flashcards e continuar rodada' : 'Começar a praticar o acervo de flashcards'}
              className="w-36 sm:w-40 h-[43px] inline-flex items-center justify-center gap-2 px-3 rounded-xl bg-[#28665E] hover:bg-[#1F524B] active:bg-[#1A453F] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:active:bg-[#235C53] text-white dark:text-[#F4F7F6] text-xs sm:text-sm font-semibold shadow-xs transition-all duration-200 cursor-pointer select-none group shrink-0"
            >
              <span className="truncate">{isLoggedIn ? 'Ir para os Cards' : 'Praticar agora'}</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/90 dark:text-[#F4F7F6]/90 transition-transform duration-200 group-hover:translate-x-0.5 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      <main
        id="capa-inicio"
        className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-7 sm:py-11 space-y-8 sm:space-y-10 ios-safe-main"
      >
        {/* 2-Column Editorial Hero + Login Split (items-stretch for balanced height) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-stretch animate-card-enter">
          {/* Left Column: Proposition + Integrated EWM Logo & Login Area */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Quiet unboxed metadata kicker */}
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] font-medium text-[#5C574E] dark:text-[#AFAAA0]">
                <span className="text-[#28665E] dark:text-[#68B4A8] font-semibold">
                  English With Mariana
                </span>
                <span aria-hidden="true">·</span>
                <span>Inglês Coloquial de Nativos</span>
                <span aria-hidden="true">·</span>
                <span>Vozes US &amp; UK</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{totalCards} expressões reais</span>
              </div>

              <h1
                style={{ textWrap: 'balance' }}
                className="font-display text-[clamp(2rem,3.6vw,3.25rem)] font-bold tracking-tight leading-[1.08] text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                Pratique o inglês que os nativos realmente falam todos os dias.
              </h1>

              <p className="text-[15px] sm:text-base leading-relaxed text-[#524E46] dark:text-[#B9B4AA] max-w-[62ch]">
                Bem-vindo(a) ao espaço oficial de estudos da{' '}
                <strong className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                  Teacher Mariana
                </strong>
                . Estude expressões reais com áudio de nativos nos sotaques{' '}
                <strong className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                  Americano (US) e Britânico (UK)
                </strong>
                , crie suas próprias cartas e misture seus baralhos pessoais com o acervo completo do EWM.
              </p>
            </div>

            {/* Integrated Login & Student Entry Surface (Single-elevation card) */}
            <div className="rounded-3xl border border-[#E2DDD3] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-5 sm:p-6 shadow-xs space-y-5">
              {/* EWM Brand Lockup + Theme Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {!logoFailed ? (
                    <img
                      src="/ewm-logo.jpg"
                      alt="Logo oficial EWM Keep practicing"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoFailed(true)}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-contain bg-white p-1 border border-[#E4E0D8] dark:border-[#343A34] shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#28665E] text-white flex items-center justify-center font-display font-bold text-lg shrink-0">
                      EWM
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                      {isLoggedIn
                        ? `Olá, ${firstName}!`
                        : 'Área do Aluno · EWM Keep practicing'}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#6B655C] dark:text-[#AFAAA0] leading-snug">
                      {isLoggedIn
                        ? syncStatus === 'synced'
                          ? 'Progresso e baralhos sincronizados na sua nuvem individual.'
                          : 'Conectando seu espaço individual na nuvem...'
                        : 'Entre para salvar seu progresso na nuvem ou pratique como visitante.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={
                    theme === 'dark'
                      ? 'Ativar modo claro na capa'
                      : 'Ativar modo escuro para leitura noturna'
                  }
                  title={
                    theme === 'dark' ? 'Mudar para Modo Claro' : 'Modo Escuro para leitura noturna'
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] dark:bg-[#272B27] text-xs font-medium text-[#5C574E] dark:text-[#D4CFC5] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] hover:border-[#C9C3B8] dark:hover:border-[#68B4A8]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Modo Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Modo Noturno</span>
                    </>
                  )}
                </button>
              </div>

              {/* User Progress Donut Chart (Recharts) */}
              <div className="pt-4 border-t border-[#ECE8DF] dark:border-[#2A2F2A] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                      Progresso Geral no Acervo
                    </span>
                    <span className="text-[11px] font-mono-num text-[#78746A] dark:text-[#AFAAA0]">
                      ({progress.total} cards)
                    </span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#28665E] dark:text-[#68B4A8]">
                    {progress.masteredPercentage}% dominado
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#FAF9F6] dark:bg-[#1B1E1B] p-3.5 rounded-2xl border border-[#E9E5DC] dark:border-[#2B302B]">
                  {/* Recharts Donut Chart */}
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={displayChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={50}
                          paddingAngle={displayChartData.length > 1 ? 3 : 0}
                          dataKey="value"
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {displayChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomProgressTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center Percentage Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="font-mono-num text-base font-extrabold text-[#1C1B18] dark:text-[#EBE7DE] leading-none">
                        {progress.masteredPercentage}%
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-[#6B655C] dark:text-[#9E998F] font-semibold mt-0.5">
                        Dominado
                      </span>
                    </div>
                  </div>

                  {/* Legend & Exact Count Breakdown */}
                  <div className="flex-1 w-full space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white/70 dark:bg-[#232723] border border-[#ECE8DF] dark:border-[#2E332E]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0 bg-[#28665E] dark:bg-[#357F74]" />
                        <span className="text-[#5C574E] dark:text-[#D4CFC5] font-medium">Dominados</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono-num">
                        <span className="font-bold text-[#1C1B18] dark:text-[#EBE7DE]">{progress.mastered}</span>
                        <span className="text-[#78746A] dark:text-[#AFAAA0]">({progress.masteredPercentage}%)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white/70 dark:bg-[#232723] border border-[#ECE8DF] dark:border-[#2E332E]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0 bg-[#D97706] dark:bg-[#D98826]" />
                        <span className="text-[#5C574E] dark:text-[#D4CFC5] font-medium">Em revisão</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono-num">
                        <span className="font-bold text-[#1C1B18] dark:text-[#EBE7DE]">{progress.review}</span>
                        <span className="text-[#78746A] dark:text-[#AFAAA0]">({progress.reviewPercentage}%)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white/70 dark:bg-[#232723] border border-[#ECE8DF] dark:border-[#2E332E]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0 bg-[#C8C3B8] dark:bg-[#454B44]" />
                        <span className="text-[#5C574E] dark:text-[#D4CFC5] font-medium">Não vistos</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono-num">
                        <span className="font-bold text-[#1C1B18] dark:text-[#EBE7DE]">{progress.unseen}</span>
                        <span className="text-[#78746A] dark:text-[#AFAAA0]">({progress.unseenPercentage}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#ECE8DF] dark:border-[#2A2F2A] pt-4">
                {!isLoggedIn ? (
                  <div className="space-y-3">
                    {/* Primary Google Cloud Login Button */}
                    <button
                      type="button"
                      disabled={isSigningIn}
                      onClick={onSignInAndEnter}
                      className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] disabled:opacity-60 text-white dark:text-[#F4F7F6] text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5"
                      >
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.98-3.09z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.98 3.09c.95-2.85 3.6-4.94 6.73-4.94z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">
                        {isSigningIn
                          ? 'Conectando com Google...'
                          : 'Login com Google'}
                      </span>
                    </button>

                    {/* Secondary Immediate Visitor Practice Button */}
                    <button
                      type="button"
                      onClick={() => onEnterApp('study')}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-[#DFDBD0] dark:border-[#343A34] dark:bg-[#262A26] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-[#1C1B18] dark:text-[#EBE7DE] text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <span className="whitespace-nowrap">
                        Continuar sem login (Modo visitante)
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
                    </button>

                    <p className="text-[12px] text-[#6B655C] dark:text-[#9E998F] text-center">
                      No modo visitante suas cartas ficam salvas neste navegador e migram
                      automaticamente quando você entrar com Google.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C574E] dark:text-[#AFAAA0]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#28665E] dark:text-[#68B4A8]">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[260px]">{userEmail}</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono-num">
                        <span>{masteredCount} dominados</span>
                        <span aria-hidden="true">·</span>
                        <span>{decksCount} baralhos</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onEnterApp('study')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>Continuar meus estudos</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEnterApp('decks')}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-[#DFDBD0] dark:border-[#343A34] dark:bg-[#262A26] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-sm font-semibold text-[#1C1B18] dark:text-[#EBE7DE] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <FolderKanban className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
                        <span>Meus Baralhos</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={onOpenAdminPanel}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#225851] dark:text-[#86CEC2] hover:underline underline-offset-4 cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Abrir Painel do Administrador</span>
                        </button>
                      ) : (
                        <span className="text-[#6B655C] dark:text-[#9E998F]">
                          Salvamento automático por rodada ativado
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={onSignOut}
                        className="inline-flex items-center gap-1 text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Trocar de conta</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Fixed & Immutable Teacher Mariana Portrait + EWM Note Scrim */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="relative flex-1 min-h-[460px] sm:min-h-[520px] lg:h-full rounded-3xl overflow-hidden border border-[#E2DDD3] dark:border-[#2E332E] bg-[#E8E3D9] dark:bg-[#212421] shadow-xs">
              {!portraitFailed ? (
                <img
                  src={TEACHER_MARIANA_PORTRAIT_SRC}
                  alt="Teacher Mariana — English With Mariana (EWM)"
                  referrerPolicy="no-referrer"
                  onError={() => setPortraitFailed(true)}
                  className="w-full h-full object-cover object-[51%_top] select-none"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#28665E] to-[#193F3A] text-white">
                  <span className="font-display text-3xl font-bold tracking-tight">
                    Teacher Mariana
                  </span>
                  <span className="text-sm text-white/80 mt-1">
                    English With Mariana · Keep practicing
                  </span>
                </div>
              )}

              {/* Measured Bottom Contrast Scrim (WCAG AA >= 4.5:1) */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-20 pb-5 px-5 sm:px-6 text-white">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg sm:text-xl font-bold tracking-tight leading-snug text-white">
                        Teacher Mariana
                      </p>
                      <p className="text-xs text-white/80">
                        Criadora do método EWM · Keep practicing
                      </p>
                    </div>

                    {!logoFailed && (
                      <img
                        src="/ewm-logo.jpg"
                        alt="Selo EWM"
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-xl object-contain bg-white p-0.5 shrink-0 shadow-sm"
                      />
                    )}
                  </div>

                  <p className="text-xs sm:text-[13px] leading-relaxed text-white/90">
                    “A fluência real nasce quando você ouve, repete em voz alta e conecta as
                    expressões à sua rotina. Keep practicing!”
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Full-Width Row Below Hero Split: 3-Column Editorial Method Overview */}
        <section
          id="metodo-ewm"
          aria-labelledby="metodo-ewm-heading"
          className="pt-4 border-t border-[#E4E0D8] dark:border-[#2E332E] space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2
                id="metodo-ewm-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                Como funciona sua prática no EWM
              </h2>
              <p className="text-sm text-[#5C574E] dark:text-[#AFAAA0] mt-1">
                Três pilares pensados pela Teacher Mariana para destravar sua escuta e fala.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenPhoneticGuide}
              className="self-start sm:self-auto text-xs sm:text-sm font-semibold text-[#28665E] dark:text-[#68B4A8] hover:underline underline-offset-4 whitespace-nowrap cursor-pointer"
            >
              Conhecer o Guia Fonético US &amp; UK →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="space-y-2">
              <div className="font-mono-num text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
                01. Vozes Nativas US &amp; UK
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                Inglês Americano e Britânico em cada card
              </h3>
              <p className="text-sm leading-relaxed text-[#5C574E] dark:text-[#AFAAA0]">
                Cada card traz duas frases reais de nativos, pronúncia em áudio US e UK para você
                escolher de cada vez e transcrição fonética adaptada para brasileiros.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-mono-num text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
                02. Baralhos Conectáveis
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                Misture suas palavras ao acervo oficial
              </h3>
              <p className="text-sm leading-relaxed text-[#5C574E] dark:text-[#AFAAA0]">
                Crie seus próprios baralhos com vocabulário das aulas e conecte quantos quiser com
                as cartas oficiais disparadas pela Teacher Mariana.
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-mono-num text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
                03. Salvamento Individual por Rodada
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                Estude no celular ou no computador
              </h3>
              <p className="text-sm leading-relaxed text-[#5C574E] dark:text-[#AFAAA0]">
                Ao entrar com sua conta Google, cada expressão marcada como dominada ou revisão é
                sincronizada automaticamente na sua nuvem privada.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="ios-safe-footer border-t border-[#E4E0D8] dark:border-[#2E332E] pt-5 px-4 sm:px-6 text-xs text-[#6B655C] dark:text-[#9E998F]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>EWM · Keep practicing — Teacher Mariana</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onEnterApp('study')}
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] transition-colors cursor-pointer"
            >
              Flashcards
            </button>
            <button
              type="button"
              onClick={() => onEnterApp('decks')}
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] transition-colors cursor-pointer"
            >
              Baralhos
            </button>
            <button
              type="button"
              onClick={onOpenPhoneticGuide}
              className="hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] transition-colors cursor-pointer"
            >
              Guia Fonético
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </footer>
    </div>
  );
}
