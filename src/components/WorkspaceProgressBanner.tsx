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
      className="relative rounded-2xl border border-[#DFDAD0] dark:border-[#2B322C] bg-white/95 dark:bg-[#1E221F]/95 px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs backdrop-blur-xs transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Daily Goal Progress + Mastery Ratio */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isGoalReached
                ? 'bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24]'
                : 'bg-[#EAF3F1] dark:bg-[#1B2E29] text-[#28665E] dark:text-[#38E5A5]'
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
              <span className="font-display text-xs sm:text-[13px] font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                Progresso Diário
              </span>
              {isGoalReached && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] dark:bg-[#78350F]/50 text-[#B45309] dark:text-[#FDE68A]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Meta!</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#6B655C] dark:text-[#A8B0AA] font-mono-num">
              <span>
                <strong className="text-[#1C1B18] dark:text-[#EBE7DE] font-bold">
                  {todayCount}
                </strong>
                /{goal} hoje
              </span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="hidden sm:inline">
                <strong className="text-[#28665E] dark:text-[#68B4A8] font-semibold">
                  {masteredCount}
                </strong>
                /{totalCards} dominados
              </span>
              <span className="sm:hidden font-bold text-[#28665E] dark:text-[#68B4A8]">
                {percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Aligned XP Pill + Ranking Position + Active Days/Hours + Goal Picker */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Live XP Pill */}
          <button
            type="button"
            onClick={onOpenRankingModal}
            title="Pontuação XP real acumulada neste mês"
            className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#C6DBD7] dark:border-[#38E5A5]/30 bg-[#EAF3F1]/90 dark:bg-[#172823] text-[11px] sm:text-xs font-bold text-[#1E4E47] dark:text-[#38E5A5] font-mono-num cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 shrink-0 fill-current opacity-85" />
            <span>{xpScore} XP</span>
          </button>

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

      {/* Sleek Aligned Progress Bar */}
      <div className="mt-2 w-full h-1.5 rounded-full bg-[#EAE6DD] dark:bg-[#2A302B] overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isGoalReached
              ? 'bg-gradient-to-r from-[#D97706] to-[#F59E0B]'
              : 'bg-gradient-to-r from-[#28665E] to-[#38E5A5]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </section>
  );
});
