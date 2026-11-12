import { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  Flame,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  formatStudyHoursMinutes,
  getMonthNamePt,
  type UserStudyStats,
} from '../utils/studyMetrics';

interface DailyGoalProgressBarProps {
  stats: UserStudyStats;
  onUpdateGoal: (newGoal: number) => void;
  onOpenMonthlyStats: () => void;
}

const PRESET_GOALS = [5, 10, 15, 20, 25, 30, 40];

export function DailyGoalProgressBar({
  stats,
  onUpdateGoal,
  onOpenMonthlyStats,
}: DailyGoalProgressBarProps) {
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const todayCount = stats.todayReviewedCardIds.length;
  const goal = stats.dailyGoal || 15;
  const percentage = Math.min(100, Math.round((todayCount / goal) * 100));
  const isGoalReached = todayCount >= goal;
  const remaining = Math.max(0, goal - todayCount);

  const activeDaysCount = stats.monthlyActiveDays.length;
  const formattedHours = formatStudyHoursMinutes(stats.monthlyStudyMinutes);
  const currentMonthName = getMonthNamePt();

  return (
    <div className="relative rounded-2xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white/95 dark:bg-[#212421]/95 p-2.5 sm:p-4 shadow-2xs backdrop-blur-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        {/* Left: Flame / Title & Goal Count */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isGoalReached
                ? 'bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24]'
                : 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8]'
            }`}
          >
            {isGoalReached ? (
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            ) : (
              <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs sm:text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                Meta Diária
              </span>
              {isGoalReached && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] dark:bg-[#78350F]/50 text-[#B45309] dark:text-[#FDE68A] border border-[#FDE68A]/60 dark:border-[#B45309]">
                  <CheckCircle2 className="w-3 h-3" />
                  Meta Atingida!
                </span>
              )}
            </div>

            <p className="text-[11px] sm:text-xs text-[#6B655C] dark:text-[#AFAAA0] mt-0.2 flex items-center gap-1.5 font-mono-num">
              <span>
                <strong className="text-[#1C1B18] dark:text-[#EBE7DE] font-bold">
                  {todayCount}
                </strong>{' '}
                / {goal} hoje
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="font-bold text-[#28665E] dark:text-[#68B4A8]">
                {percentage}%
              </span>
            </p>
          </div>
        </div>

        {/* Right: Monthly Quick Stats Badges & Goal Config Button */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenMonthlyStats}
            title="Ver estatísticas mensais e ranking"
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#ECE8DF] dark:border-[#2F342F] bg-[#FAF9F6] dark:bg-[#1C1F1C] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-[11px] sm:text-xs text-[#5C574E] dark:text-[#D4CFC5] transition-colors cursor-pointer"
          >
            <span className="text-xs">📅</span>
            <span className="font-medium">
              <strong className="text-[#1C1B18] dark:text-[#EBE7DE] font-bold font-mono-num">
                {activeDaysCount}
              </strong>
              <span className="hidden sm:inline">
                {' '}
                {activeDaysCount === 1 ? 'dia' : 'dias'} em {currentMonthName}
              </span>
              <span className="sm:hidden">d</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenMonthlyStats}
            title="Tempo total dedicado este mês"
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#ECE8DF] dark:border-[#2F342F] bg-[#FAF9F6] dark:bg-[#1C1F1C] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-[11px] sm:text-xs text-[#5C574E] dark:text-[#D4CFC5] transition-colors cursor-pointer"
          >
            <span className="text-xs">⏱️</span>
            <span className="font-medium font-mono-num text-[#1C1B18] dark:text-[#EBE7DE] font-bold">
              {formattedHours}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenMonthlyStats}
            title="Ver pódio e ranking dos melhores estudantes"
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#ECE8DF] dark:border-[#2F342F] bg-[#FAF9F6] dark:bg-[#1C1F1C] hover:border-[#D97706] text-[11px] sm:text-xs font-semibold text-[#B45309] dark:text-[#FBBF24] transition-colors cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Ranking</span>
          </button>

          {/* Goal Config dropdown button */}
          <div className="relative ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => setShowGoalPicker((v) => !v)}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#D4DFDC] dark:border-[#324D48] bg-white dark:bg-[#252A25] text-[11px] sm:text-xs font-semibold text-[#28665E] dark:text-[#86CEC2] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E] transition-colors cursor-pointer"
              title="Ajustar meta diária de cards"
            >
              <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Meta: {goal}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Quick Goal Picker Dropdown */}
            {showGoalPicker && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-48 rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-2.5 shadow-xl animate-fade-in text-xs">
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
                      className={`py-1.5 rounded-lg font-mono-num font-semibold text-center transition-colors cursor-pointer ${
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

      {/* Progress Bar Track */}
      <div className="mt-2 sm:mt-3">
        <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#EAE6DD] dark:bg-[#2C302C] overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${
              isGoalReached
                ? 'bg-gradient-to-r from-[#D97706] to-[#F59E0B]'
                : 'bg-gradient-to-r from-[#28665E] to-[#469C90] dark:from-[#357F74] dark:to-[#68B4A8]'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Dynamic Encouragement Message */}
        <div className="flex items-center justify-between text-[11px] text-[#6B655C] dark:text-[#AFAAA0] mt-1.5">
          <span>
            {isGoalReached ? (
              <span className="text-[#D97706] dark:text-[#FBBF24] font-semibold flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                Parabéns! Você bateu sua meta de hoje. Continue praticando para subir no ranking!
              </span>
            ) : (
              <span>
                Faltam <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">{remaining}</strong>{' '}
                {remaining === 1 ? 'card' : 'cards'} para bater sua meta diária.
              </span>
            )}
          </span>

          <span className="font-mono-num font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}
