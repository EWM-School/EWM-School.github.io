import { memo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { triggerTap } from '../../services/platform/hapticsService';
import { stopCurrentAudio } from '../../services/platform/speechService';
import {
  ARENA_FREE_TRAINING_BADGE_PT,
  type MiniGameXpAwardOutcome,
} from '../../utils/gameXpPolicy';

interface MiniGameTopHudProps {
  title: string;
  subtitle?: string;
  progressLabel: string;
  rightBadge?: React.ReactNode;
  floatingXp?: { amount: number; key: number } | null;
  dailyCapReached?: boolean;
  onBackToArena: () => void;
}

export const MiniGameTopHud = memo(function MiniGameTopHud({
  title,
  subtitle,
  progressLabel,
  rightBadge,
  floatingXp,
  dailyCapReached = false,
  onBackToArena,
}: MiniGameTopHudProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            void triggerTap();
            stopCurrentAudio();
            onBackToArena();
          }}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#DFDBD0] dark:border-[#2E3630] bg-white dark:bg-[#1F2420] text-xs font-semibold text-[#5C574E] dark:text-[#C8D0CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Voltar à Arena</span>
        </button>

        <div className="relative flex items-center gap-2">
          {floatingXp && floatingXp.amount > 0 && (
            <span
              key={floatingXp.key}
              className="ewm-float-xp absolute -top-6 right-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#38E5A5] text-[#0D2B22] font-mono-num text-[11px] font-extrabold shadow-xs whitespace-nowrap"
            >
              +{floatingXp.amount} XP
            </span>
          )}

          {rightBadge}

          <span className="min-h-[36px] inline-flex items-center px-3 py-1 rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE] font-mono-num">
            {progressLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-[#6B655C] dark:text-[#AFAAA0]">
              {subtitle}
            </p>
          )}
        </div>

        {dailyCapReached && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#C6DBD7] dark:border-[#2F4B46] bg-[#F2F8F6] dark:bg-[#1A2925] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Modo treino livre ativo</span>
          </span>
        )}
      </div>
    </div>
  );
});

interface MiniGameResultSummaryProps {
  title: string;
  subtitle: string;
  correctCount: number;
  totalItems: number;
  mistakesCount: number;
  outcome: MiniGameXpAwardOutcome | null;
  extraStatBadge?: { label: string; value: string; highlight?: boolean } | null;
  onPlayAgain: () => void;
  onBackToArena: () => void;
  onOpenRankingModal?: () => void;
}

export const MiniGameResultSummary = memo(function MiniGameResultSummary({
  title,
  subtitle,
  correctCount,
  totalItems,
  mistakesCount,
  outcome,
  extraStatBadge,
  onPlayAgain,
  onBackToArena,
  onOpenRankingModal,
}: MiniGameResultSummaryProps) {
  const accuracyPct =
    totalItems > 0 ? Math.round((correctCount / totalItems) * 100) : 0;
  const awardedXp = outcome?.awardedXp ?? 0;
  const isPerfect = outcome?.breakdown.isPerfect ?? false;
  const capReached = outcome?.dailyCapReached ?? false;

  return (
    <div className="max-w-xl mx-auto rounded-3xl border border-[#C6DBD7] dark:border-[#38E5A5]/35 bg-white dark:bg-[#1E2420] p-5 sm:p-7 shadow-xs space-y-5 ewm-pillar-enter">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF3F1] dark:bg-[#1C332D] text-[#225851] dark:text-[#38E5A5] text-[11px] font-bold uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Partida Concluída</span>
          </span>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#B5C0B9]">
            {subtitle}
          </p>
        </div>

        <div className="relative shrink-0">
          {awardedXp > 0 && (
            <span className="ewm-float-xp absolute -top-5 right-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#38E5A5] text-[#0B2920] font-mono-num text-xs font-extrabold">
              +{awardedXp} XP
            </span>
          )}
          <div className="px-3.5 py-2 rounded-2xl border border-[#C6DBD7] dark:border-[#2E4D44] bg-[#F3FAF8] dark:bg-[#172823] text-center">
            <div className="font-mono-num text-base sm:text-lg font-extrabold text-[#225851] dark:text-[#38E5A5] flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 fill-current" />
              <span>+{awardedXp} XP</span>
            </div>
            <div className="text-[10px] font-semibold text-[#5C574E] dark:text-[#9CA8A1]">
              creditados hoje
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-[#E6E2D8] dark:border-[#2C332E] bg-[#FAF9F6] dark:bg-[#232925] p-3 text-center">
          <div className="font-mono-num text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
            {correctCount}/{totalItems}
          </div>
          <div className="text-[11px] text-[#6B655C] dark:text-[#A0A8A2]">
            Acertos
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6E2D8] dark:border-[#2C332E] bg-[#FAF9F6] dark:bg-[#232925] p-3 text-center">
          <div className="font-mono-num text-base sm:text-lg font-bold text-[#28665E] dark:text-[#38E5A5]">
            {accuracyPct}%
          </div>
          <div className="text-[11px] text-[#6B655C] dark:text-[#A0A8A2]">
            Precisão
          </div>
        </div>

        {extraStatBadge ? (
          <div
            className={`rounded-2xl border p-3 text-center ${
              extraStatBadge.highlight
                ? 'border-[#F59E0B]/50 bg-[#FFFBEB] dark:bg-[#2C2415] dark:border-[#FBBF24]/40'
                : 'border-[#E6E2D8] dark:border-[#2C332E] bg-[#FAF9F6] dark:bg-[#232925]'
            }`}
          >
            <div className="font-mono-num text-base sm:text-lg font-bold text-[#B45309] dark:text-[#FBBF24] inline-flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-current" />
              <span>{extraStatBadge.value}</span>
            </div>
            <div className="text-[11px] text-[#6B655C] dark:text-[#A0A8A2]">
              {extraStatBadge.label}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E6E2D8] dark:border-[#2C332E] bg-[#FAF9F6] dark:bg-[#232925] p-3 text-center">
            <div className="font-mono-num text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
              {mistakesCount}
            </div>
            <div className="text-[11px] text-[#6B655C] dark:text-[#A0A8A2]">
              Deslizes
            </div>
          </div>
        )}
      </div>

      {/* Perfect Bonus or Anti-Farming Status Banner */}
      {isPerfect && awardedXp > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-[#38E5A5]/50 bg-[#ECFDF5] dark:bg-[#163026] text-xs font-semibold text-[#165B43] dark:text-[#6EE7B7]">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
          <span>
            Partida impecável sem erros! Bônus de precisão (+3 XP) incluído.
          </span>
        </div>
      )}

      {capReached && (
        <div
          role="status"
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-[#C6DBD7] dark:border-[#2F4B46] bg-[#F4FAF8] dark:bg-[#192824] text-xs font-semibold text-[#225851] dark:text-[#86CEC2]"
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{ARENA_FREE_TRAINING_BADGE_PT}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#E6E2D8] dark:border-[#2C332E]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              stopCurrentAudio();
              onBackToArena();
            }}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-[#DFDBD0] dark:border-[#2E3630] bg-[#FAF9F6] dark:bg-[#252B26] text-xs sm:text-sm font-semibold text-[#4A463E] dark:text-[#D0D7D2] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar à Arena</span>
          </button>

          {onOpenRankingModal && (
            <button
              type="button"
              onClick={() => {
                void triggerTap();
                onOpenRankingModal();
              }}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-[#EAD9B8] dark:border-[#4A3B22] bg-[#FFFDF8] dark:bg-[#262016] text-xs font-semibold text-[#B45309] dark:text-[#FBBF24] cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Ranking</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            void triggerTap();
            stopCurrentAudio();
            onPlayAgain();
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Jogar Novamente</span>
        </button>
      </div>
    </div>
  );
});
