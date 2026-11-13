import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Eraser, Sparkles } from 'lucide-react';
import { useAudioPlaybackState } from '../../hooks/useAudioPlaybackState';
import {
  triggerError,
  triggerSuccess,
  triggerTap,
} from '../../services/platform/hapticsService';
import {
  speakEnglishText,
  stopCurrentAudio,
  toggleSpeakEnglishText,
} from '../../services/platform/speechService';
import {
  buildExpressionBuilderRound,
  shuffleDeterministicOrRandom,
  validateExpressionBuilderAttempt,
  type BuilderBlockItem,
  type ExpressionBuilderRound,
  type NormalizedGameCard,
} from '../../utils/gameContentNormalizer';
import type {
  MiniGameSessionMetrics,
  MiniGameXpAwardOutcome,
} from '../../utils/gameXpPolicy';
import { AudioStatusIcon } from '../CardAudioControls';
import { MiniGameResultSummary, MiniGameTopHud } from './MiniGameSharedUi';

const ROUNDS_PER_BUILDER_MATCH = 6;

interface ExpressionBuilderGameProps {
  pool: readonly NormalizedGameCard[];
  dailyCapReached: boolean;
  onCompleteMatch: (metrics: MiniGameSessionMetrics) => MiniGameXpAwardOutcome;
  onBackToArena: () => void;
  onOpenRankingModal?: () => void;
}

function createBuilderMatchRounds(pool: readonly NormalizedGameCard[]): ExpressionBuilderRound[] {
  const shuffled = shuffleDeterministicOrRandom(pool);
  const count = Math.min(ROUNDS_PER_BUILDER_MATCH, Math.max(1, shuffled.length));
  const selected = shuffled.slice(0, count);
  return selected.map((card) => buildExpressionBuilderRound(card));
}

export const ExpressionBuilderGame = memo(function ExpressionBuilderGame({
  pool,
  dailyCapReached,
  onCompleteMatch,
  onBackToArena,
  onOpenRankingModal,
}: ExpressionBuilderGameProps) {
  const { getButtonState } = useAudioPlaybackState();

  const [rounds, setRounds] = useState<ExpressionBuilderRound[]>(() =>
    createBuilderMatchRounds(pool)
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [roundSolved, setRoundSolved] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [slotErrorMask, setSlotErrorMask] = useState<boolean[] | null>(null);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [flawlessRoundsCount, setFlawlessRoundsCount] = useState(0);
  const [hadMistakeThisRound, setHadMistakeThisRound] = useState(false);
  const [finishedOutcome, setFinishedOutcome] =
    useState<MiniGameXpAwardOutcome | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(
    null
  );

  const solvedLockRef = useRef(false);

  const currentRound = rounds[roundIdx] ?? null;

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  const placedBlocks = useMemo(() => {
    if (!currentRound) return [];
    const byId = new Map(currentRound.shuffledTray.map((b) => [b.id, b]));
    return placedIds
      .map((id) => byId.get(id))
      .filter((b): b is BuilderBlockItem => Boolean(b));
  }, [currentRound, placedIds]);

  const placedSet = useMemo(() => new Set(placedIds), [placedIds]);

  const availableBlocks = useMemo(() => {
    if (!currentRound) return [];
    return currentRound.shuffledTray.filter((b) => !placedSet.has(b.id));
  }, [currentRound, placedSet]);

  const handleEvaluateCompleteAttempt = useCallback(
    (nextPlacedIds: string[]) => {
      if (!currentRound || solvedLockRef.current) return;
      if (nextPlacedIds.length !== currentRound.expectedBlocks.length) {
        setSlotErrorMask(null);
        return;
      }

      const byId = new Map(currentRound.shuffledTray.map((b) => [b.id, b]));
      const candidateBlocks = nextPlacedIds
        .map((id) => byId.get(id))
        .filter((b): b is BuilderBlockItem => Boolean(b));

      const check = validateExpressionBuilderAttempt(
        candidateBlocks,
        currentRound.expectedBlocks
      );

      if (check.isCorrect) {
        solvedLockRef.current = true;
        setRoundSolved(true);
        setSlotErrorMask(null);
        if (!hadMistakeThisRound) {
          setFlawlessRoundsCount((c) => c + 1);
        }
        void triggerSuccess();
        void speakEnglishText(currentRound.targetEnglish, 'us', {
          role: currentRound.speechRole,
          sourceId: `builder-auto-${currentRound.roundId}`,
        });
      } else {
        setMistakesCount((m) => m + 1);
        setHadMistakeThisRound(true);
        setSlotErrorMask(check.slotMatches.map((ok) => !ok));
        setShakeTrigger((k) => k + 1);
        void triggerError();
      }
    },
    [currentRound, hadMistakeThisRound]
  );

  const handlePlaceBlock = useCallback(
    (blockId: string) => {
      if (!currentRound || roundSolved) return;
      if (placedIds.includes(blockId)) return;
      void triggerTap();
      const next = [...placedIds, blockId];
      setPlacedIds(next);
      handleEvaluateCompleteAttempt(next);
    },
    [currentRound, handleEvaluateCompleteAttempt, placedIds, roundSolved]
  );

  const handleReturnPlacedBlock = useCallback(
    (blockId: string) => {
      if (roundSolved) return;
      void triggerTap();
      setSlotErrorMask(null);
      setPlacedIds((prev) => prev.filter((id) => id !== blockId));
    },
    [roundSolved]
  );

  const handleClearSlots = useCallback(() => {
    if (roundSolved || placedIds.length === 0) return;
    void triggerTap();
    setSlotErrorMask(null);
    setPlacedIds([]);
  }, [placedIds.length, roundSolved]);

  const handleNextRound = useCallback(() => {
    if (!currentRound) return;
    void triggerTap();
    stopCurrentAudio();

    if (roundIdx + 1 >= rounds.length) {
      const outcome = onCompleteMatch({
        gameId: 'expression-builder',
        correctCount: rounds.length,
        totalItems: rounds.length,
        mistakesCount,
      });
      setFinishedOutcome(outcome);
      if (outcome.awardedXp > 0) {
        setFloatingXp({ amount: outcome.awardedXp, key: Date.now() });
      }
      setIsFinished(true);
      return;
    }

    solvedLockRef.current = false;
    setRoundIdx((i) => i + 1);
    setPlacedIds([]);
    setRoundSolved(false);
    setSlotErrorMask(null);
    setHadMistakeThisRound(false);
  }, [currentRound, mistakesCount, onCompleteMatch, roundIdx, rounds.length]);

  const handlePlayAgain = useCallback(() => {
    stopCurrentAudio();
    solvedLockRef.current = false;
    setRounds(createBuilderMatchRounds(pool));
    setRoundIdx(0);
    setPlacedIds([]);
    setRoundSolved(false);
    setSlotErrorMask(null);
    setMistakesCount(0);
    setFlawlessRoundsCount(0);
    setHadMistakeThisRound(false);
    setFinishedOutcome(null);
    setIsFinished(false);
  }, [pool]);

  // Desktop keyboard shortcuts: [1..9] place block, [Backspace] undo last block, [Enter] next round
  useEffect(() => {
    if (isFinished || !currentRound) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (roundSolved && e.key === 'Enter') {
        e.preventDefault();
        handleNextRound();
        return;
      }

      if (!roundSolved && e.key === 'Backspace' && placedIds.length > 0) {
        e.preventDefault();
        handleReturnPlacedBlock(placedIds[placedIds.length - 1]);
        return;
      }

      const num = Number(e.key);
      if (!roundSolved && num >= 1 && num <= 9 && availableBlocks[num - 1]) {
        e.preventDefault();
        handlePlaceBlock(availableBlocks[num - 1].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    availableBlocks,
    currentRound,
    handleNextRound,
    handlePlaceBlock,
    handleReturnPlacedBlock,
    isFinished,
    placedIds,
    roundSolved,
  ]);

  if (isFinished) {
    return (
      <MiniGameResultSummary
        title="Monte a Expressão Concluído!"
        subtitle={`${flawlessRoundsCount} de ${rounds.length} construções acertadas de primeira.`}
        correctCount={rounds.length}
        totalItems={rounds.length}
        mistakesCount={mistakesCount}
        outcome={finishedOutcome}
        onPlayAgain={handlePlayAgain}
        onBackToArena={onBackToArena}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  if (!currentRound) return null;

  const usHintState = getButtonState({
    text: currentRound.targetEnglish,
    accent: 'us',
    sourceId: `builder-hint-us-${currentRound.roundId}`,
  });
  const ukHintState = getButtonState({
    text: currentRound.targetEnglish,
    accent: 'uk',
    sourceId: `builder-hint-uk-${currentRound.roundId}`,
  });

  const stateClass = (st: 'idle' | 'loading' | 'playing') =>
    st === 'loading' ? 'ewm-audio-loading' : st === 'playing' ? 'ewm-audio-playing' : '';

  return (
    <div className="max-w-2xl mx-auto space-y-4 ewm-pillar-enter select-none">
      <MiniGameTopHud
        title="Monte a Expressão"
        subtitle="Toque nos blocos em inglês na ordem natural (clique num bloco montado para devolver)"
        progressLabel={`${roundIdx + 1} / ${rounds.length}`}
        floatingXp={floatingXp}
        dailyCapReached={dailyCapReached}
        onBackToArena={onBackToArena}
      />

      <div className="rounded-3xl border border-[#DFDAD0] dark:border-[#313831] bg-white dark:bg-[#202420] p-4 sm:p-6 shadow-xs space-y-5">
        {/* Prompt Header + Optional US/UK Audio Hint */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F2EFE8] dark:bg-[#2A2F2A] text-[#5C574E] dark:text-[#B9B4AA]">
              <span>{currentRound.card.category}</span>
              <span aria-hidden="true">·</span>
              <span>{currentRound.card.subtopic}</span>
            </span>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                aria-pressed={usHintState !== 'idle'}
                aria-busy={usHintState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(currentRound.targetEnglish, 'us', {
                    role: currentRound.speechRole,
                    sourceId: `builder-hint-us-${currentRound.roundId}`,
                  });
                }}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold cursor-pointer ${stateClass(
                  usHintState
                )} ${
                  usHintState !== 'idle'
                    ? 'bg-[#28665E] border-[#28665E] text-white'
                    : 'bg-[#EAF3F1] dark:bg-[#1E312E] border-[#C6DBD7] dark:border-[#2F4B46] text-[#225851] dark:text-[#86CEC2]'
                }`}
              >
                <AudioStatusIcon
                  state={usHintState}
                  idleClassName="w-3.5 h-3.5"
                  activeClassName="w-3.5 h-3"
                />
                <span>Dica US</span>
              </button>

              <button
                type="button"
                aria-pressed={ukHintState !== 'idle'}
                aria-busy={ukHintState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(currentRound.targetEnglish, 'uk', {
                    role: currentRound.speechRole,
                    sourceId: `builder-hint-uk-${currentRound.roundId}`,
                  });
                }}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold cursor-pointer ${stateClass(
                  ukHintState
                )} ${
                  ukHintState !== 'idle'
                    ? 'bg-[#243B53] border-[#243B53] text-white'
                    : 'bg-[#EDF1F5] dark:bg-[#1E2630] border-[#C9D5E2] dark:border-[#334354] text-[#243B53] dark:text-[#9CC3E6]'
                }`}
              >
                <AudioStatusIcon
                  state={ukHintState}
                  idleClassName="w-3.5 h-3.5"
                  activeClassName="w-3.5 h-3"
                />
                <span>Dica UK</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#28665E] dark:text-[#68B4A8]">
              Como dizer em inglês natural:
            </p>
            <h3 className="font-display text-lg sm:text-xl font-bold text-[#1C1B18] dark:text-[#F4F7F6] leading-snug">
              &ldquo;{currentRound.promptPt}&rdquo;
            </h3>
            {currentRound.helperContextPt && (
              <p className="text-xs text-[#6B655C] dark:text-[#A4A096]">
                {currentRound.helperContextPt}
              </p>
            )}
          </div>
        </div>

        {/* Assembled Answer Zone */}
        <div
          key={`answer-zone-${shakeTrigger}`}
          className={`min-h-[84px] rounded-2xl border-2 p-3 sm:p-4 transition-colors flex flex-wrap items-center gap-2 ${
            roundSolved
              ? 'border-[#38E5A5] bg-[#ECFDF5] dark:bg-[#152E24] shadow-[0_0_0_3px_rgba(56,229,165,0.16)]'
              : slotErrorMask
              ? 'ewm-micro-shake border-[#D97706]/60 bg-[#FFFBEB]/70 dark:bg-[#2B2216]'
              : 'border-dashed border-[#D6D1C4] dark:border-[#363E37] bg-[#FAF9F6] dark:bg-[#1A1E1B]'
          }`}
          aria-label="Área de montagem da expressão"
        >
          {placedBlocks.length === 0 ? (
            <span className="text-xs text-[#857F74] dark:text-[#7E8680] italic">
              Toque nos blocos abaixo para montar a expressão na ordem correta...
            </span>
          ) : (
            <>
              {placedBlocks.map((blk, idx) => {
                const isMisplaced = Boolean(slotErrorMask && slotErrorMask[idx]);
                return (
                  <button
                    key={blk.id}
                    type="button"
                    disabled={roundSolved}
                    onClick={() => handleReturnPlacedBlock(blk.id)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl font-semibold text-sm border cursor-pointer ${
                      roundSolved
                        ? 'border-[#38E5A5] bg-[#38E5A5]/20 dark:bg-[#38E5A5]/25 text-[#0F3D2E] dark:text-[#D1FAE5] cursor-default'
                        : isMisplaced
                        ? 'border-[#D97706] bg-[#FEF3C7] dark:bg-[#3A2B14] text-[#92400E] dark:text-[#FDE68A]'
                        : 'border-[#28665E]/45 bg-white dark:bg-[#252D28] text-[#1C1B18] dark:text-[#F4F7F6] shadow-2xs hover:border-[#B5443C]/50'
                    }`}
                  >
                    {blk.text}
                  </button>
                );
              })}
              <span
                aria-hidden="true"
                className="font-display text-base font-bold text-[#6B655C] dark:text-[#A4A096] pl-0.5"
              >
                {currentRound.terminalPunctuation}
              </span>
            </>
          )}
        </div>

        {slotErrorMask && !roundSolved && (
          <div className="flex items-center justify-between gap-2 text-xs text-[#92400E] dark:text-[#FBBF24] px-1">
            <span>
              Quase lá! Toque nos blocos destacados em âmbar para ajustar a ordem.
            </span>
            <button
              type="button"
              onClick={handleClearSlots}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E5D3B0] dark:border-[#4A3B22] text-xs font-semibold cursor-pointer shrink-0"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Recomeçar</span>
            </button>
          </div>
        )}

        {/* Shuffled Block Tray */}
        {!roundSolved && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#6B655C] dark:text-[#9CA49E]">
              <span>Bandeja de blocos ({availableBlocks.length} restantes)</span>
              {placedBlocks.length > 0 && !slotErrorMask && (
                <button
                  type="button"
                  onClick={handleClearSlots}
                  className="inline-flex items-center gap-1 hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {currentRound.shuffledTray.map((blk) => {
                const used = placedSet.has(blk.id);
                return (
                  <button
                    key={blk.id}
                    type="button"
                    disabled={used}
                    onClick={() => handlePlaceBlock(blk.id)}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      used
                        ? 'border-dashed border-[#E4E0D8] dark:border-[#2C332E] bg-transparent text-transparent select-none pointer-events-none'
                        : 'border-[#D5CFC2] dark:border-[#37413A] bg-[#FAF9F6] hover:bg-[#EAF3F1] dark:bg-[#272D28] dark:hover:bg-[#22352F] text-[#1C1B18] dark:text-[#F4F7F6] hover:border-[#28665E]/50 shadow-2xs cursor-pointer'
                    }`}
                  >
                    {blk.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Solved Celebration Bar */}
        {roundSolved && (
          <div className="rounded-2xl border border-[#38E5A5]/60 bg-[#ECFDF5] dark:bg-[#163026] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 ewm-pillar-enter">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F5132] dark:text-[#6EE7B7]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ordem sintática perfeita!</span>
                </div>
                <p className="text-sm font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                  {currentRound.targetEnglish}
                </p>
                <p className="text-[11px] font-mono-num text-[#225851] dark:text-[#86CEC2]">
                  US {currentRound.card.phoneticUs} · UK {currentRound.card.phoneticUk}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextRound}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer ml-auto"
            >
              <span>
                {roundIdx + 1 >= rounds.length ? 'Concluir Partida' : 'Próxima Expressão'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
