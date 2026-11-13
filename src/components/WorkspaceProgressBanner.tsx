import { memo, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Flame,
  Settings,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  computeLeaderboard,
  formatStudyHoursMinutes,
  getMonthNamePt,
  type CloudLeaderboardRecord,
  type UserStudyStats,
} from '../utils/studyMetrics';

interface WorkspaceProgressBannerProps {
  stats: UserStudyStats;
  userDisplayName: string | null;
  userEmail: string | null;
  currentUid: string | null;
  masteredCount: number;
  reviewCount: number;
  totalCards: number;
  quizScore: number;
  cloudLeaderboard: CloudLeaderboardRecord[];
  recentXpDelta?: { amount: number; key: number } | null;
  onUpdateGoal: (newGoal: number) => void;
  onOpenRankingModal: () => void;
}

const PRESET_GOALS = [5, 10, 15, 20, 25, 30, 40];

export const WorkspaceProgressBanner = memo(function WorkspaceProgressBanner({
  stats,
  userDisplayName,
  userEmail,
  currentUid,
  masteredCount,
  reviewCount,
  totalCards,
  quizScore,
  cloudLeaderboard,
  recentXpDelta,
  onUpdateGoal,
  onOpenRankingModal,
}: WorkspaceProgressBannerProps) {
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const todayCount = stats.todayReviewedCardIds.length;
  const goal = stats.dailyGoal || 15;
  const percentage = Math.min(100, Math.round((todayCount / goal) * 100));
  const isGoalReached = todayCount >= goal;
  const activeDaysCount = stats.monthlyActiveDays.length;
  const formattedHours = formatStudyHoursMinutes(stats.monthlyStudyMinutes);
  const currentMonthName = getMonthNamePt();

  const { currentUserEntry } = useMemo(
    () =>
      computeLeaderboard(userDisplayName, stats, {
        currentUid,
        currentUserEmail: userEmail,
        masteredCount,
        reviewCount,
        quizScore,
        cloudEntries: cloudLeaderboard,
      }),
    [
      userDisplayName,
      stats,
      currentUid,
      userEmail,
      masteredCount,
      reviewCount,
      quizScore,
      cloudLeaderboard,
    ]
  );

  const xpScore = currentUserEntry.score;
  const rank = currentUserEntry.rank;

  return (
    <section
      aria-label="Resumo de Progresso, XP e Posição no Ranking"
      className="relative rounded-2xl border ewm-surface-neon bg-white/95 dark:bg-[#131A22]/95 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-xs transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Daily Goal Progress + Mastery Ratio */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isGoalReached
                ? 'bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24] shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                : 'bg-[#ECFDF5] dark:bg-[#142D24] text-[#00C982] dark:text-[#38E5A5] border border-[#00C982]/25 dark:border-[#38E5A5]/25'
            }`}
          >
            {isGoalReached ? (
              <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            ) : (
              <Flame className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display text-xs sm:text-[13px] font-bold text-[#121816] dark:text-[#F1F5F9]">
                Progresso Diário
              </span>
              {isGoalReached && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] dark:bg-[#78350F]/50 text-[#B45309] dark:text-[#FDE68A]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Meta!</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#52605B] dark:text-[#9CB0A9] font-mono-num">
              <span>
                <strong className="text-[#121816] dark:text-[#F1F5F9] font-bold">
                  {todayCount}
                </strong>
                /{goal} hoje
              </span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="hidden sm:inline">
                <strong className="text-[#059669] dark:text-[#38E5A5] font-semibold">
                  {masteredCount}
                </strong>
                /{totalCards} dominados
              </span>
              <span className="sm:hidden font-bold text-[#059669] dark:text-[#38E5A5]">
                {percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Aligned XP Pill + Ranking Position + Active Days/Hours + Goal Picker */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Live XP Pill + Floating +XP Animation */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={onOpenRankingModal}
              title="Pontuação XP real acumulada neste mês"
              className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#00C982]/40 dark:border-[#38E5A5]/38 bg-[#ECFDF5] dark:bg-[#122A22] text-[11px] sm:text-xs font-bold text-[#047857] dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.18)] dark:shadow-[0_0_12px_rgba(56,229,165,0.2)] font-mono-num cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 shrink-0 fill-[#FBBF24] text-[#F59E0B] dark:text-[#FBBF24]" />
              <span>{xpScore} XP</span>
            </button>
            {recentXpDelta && recentXpDelta.amount > 0 && (
              <span
                key={recentXpDelta.key}
                aria-hidden="true"
                className="ewm-float-xp pointer-events-none absolute -top-2.5 right-0 px-1.5 py-0.5 rounded-md bg-[#38E5A5] text-[#0B1F17] text-[10px] font-extrabold font-mono-num shadow-sm"
              >
                +{recentXpDelta.amount} XP
              </span>
            )}
          </div>

          {/* Live Ranking Position Pill */}
          <button
            type="button"
            onClick={onOpenRankingModal}
            title={`Ver posição no Ranking de ${currentMonthName}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#EAD9B8] dark:border-[#4A3B22] bg-[#FFFDF8] dark:bg-[#241F17] hover:border-[#D97706] text-[11px] sm:text-xs font-semibold text-[#B45309] dark:text-[#FBBF24] cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono-num">
              {rank > 0 ? `#${rank} no Ranking` : 'Ranking'}
            </span>
          </button>

          {/* Compact Monthly Consistency Pill (Desktop & Tablet) */}
          <button
            type="button"
            onClick={onOpenRankingModal}
            title={`${activeDaysCount} dias ativos e ${formattedHours} de prática em ${currentMonthName}`}
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#ECE8DF] dark:border-[#2C332D] bg-[#FAF9F6] dark:bg-[#191D1A] text-xs text-[#5C574E] dark:text-[#C8CEC9] font-mono-num cursor-pointer"
          >
            <span>📅 {activeDaysCount}d</span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span>⏱️ {formattedHours}</span>
          </button>

          {/* Goal Picker Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGoalPicker((v) => !v)}
              title="Ajustar meta diária de cards"
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#DFDBD0] dark:border-[#2F3731] bg-[#FAF9F6] dark:bg-[#232824] text-[11px] sm:text-xs font-semibold text-[#5C574E] dark:text-[#D4CFC5] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] cursor-pointer"
            >
              <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
              <span className="hidden sm:inline font-mono-num">Meta: {goal}</span>
              <ChevronDown className="w-3 h-3 opacity-65" />
            </button>

            {showGoalPicker && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-48 rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-2.5 shadow-xl ewm-pillar-enter text-xs">
                <p className="font-bold text-[#1C1B18] dark:text-[#EBE7DE] mb-1.5 px-1">
                  Escolher meta diária:
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {PRESET_GOALS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        onUpdateGoal(preset);
                        setShowGoalPicker(false);
                      }}
                      className={`py-1.5 rounded-lg font-mono-num font-semibold text-center cursor-pointer ${
                        preset === goal
                          ? 'bg-[#28665E] text-white dark:bg-[#2A6D63]'
                          : 'hover:bg-[#EAE6DD] dark:hover:bg-[#2F342F] text-[#1C1B18] dark:text-[#EBE7DE]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[#ECE8DF] dark:border-[#2E332E] text-[11px] text-[#6B655C] dark:text-[#9E998F] text-center">
                  Recomendado: 15 cards/dia
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sleek Neon Progress Bar with Golden Spark */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-[#E2EFEA] dark:bg-[#1B2632] overflow-visible relative">
          <div
            className={`h-full transition-all duration-300 rounded-full ewm-neon-progress ${
              isGoalReached
                ? 'bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]'
                : 'bg-gradient-to-r from-[#00C982] via-[#10D990] to-[#38E5A5]'
            }`}
            style={{ width: `${Math.max(percentage, todayCount > 0 ? 6 : 3)}%` }}
          />
        </div>
        <Zap
          aria-hidden="true"
          className="w-3.5 h-3.5 shrink-0 text-[#F59E0B] dark:text-[#FBBF24] fill-[#FBBF24] drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
        />
      </div>
    </section>
  );
});
