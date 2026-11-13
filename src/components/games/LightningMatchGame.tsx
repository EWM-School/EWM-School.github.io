import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Timer, Volume2, VolumeX } from 'lucide-react';
import {
  triggerError,
  triggerSuccess,
  triggerTap,
} from '../../services/platform/hapticsService';
import {
  speakEnglishText,
  stopCurrentAudio,
} from '../../services/platform/speechService';
import {
  LIGHTNING_VISIBLE_SLOTS,
  buildLightningMatchDeck,
  shuffleDeterministicOrRandom,
  type LightningPairItem,
  type NormalizedGameCard,
} from '../../utils/gameContentNormalizer';
import type {
  MiniGameSessionMetrics,
  MiniGameXpAwardOutcome,
} from '../../utils/gameXpPolicy';
import { MiniGameResultSummary, MiniGameTopHud } from './MiniGameSharedUi';

const DEFAULT_MATCH_TOTAL_PAIRS = 16;

interface SlotEntry {
  pairId: string;
  text: string;
  subNote?: string | null;
  state: 'idle' | 'dissolving';
}

interface BoardState {
  deck: LightningPairItem[];
  nextQueueIdx: number;
  leftSlots: (SlotEntry | null)[];
  rightSlots: (SlotEntry | null)[];
}

function createInitialLightningBoard(
  pool: readonly NormalizedGameCard[],
  allReferenceCards: readonly NormalizedGameCard[]
): BoardState {
  const deck = buildLightningMatchDeck(
    pool,
    allReferenceCards,
    DEFAULT_MATCH_TOTAL_PAIRS
  );
  const initialSlice = deck.slice(0, LIGHTNING_VISIBLE_SLOTS);

  const leftSlots: (SlotEntry | null)[] = Array.from(
    { length: LIGHTNING_VISIBLE_SLOTS },
    (_, i) => {
      const item = initialSlice[i];
      return item
        ? {
            pairId: item.pairId,
            text: item.englishText,
            subNote: item.contextualNote,
            state: 'idle',
          }
        : null;
    }
  );

  let shuffledRightItems = shuffleDeterministicOrRandom(initialSlice);
  if (
    initialSlice.length >= 2 &&
    shuffledRightItems.every((r, idx) => r.pairId === initialSlice[idx]?.pairId)
  ) {
    shuffledRightItems = [...shuffledRightItems.slice(1), shuffledRightItems[0]];
  }

  const rightSlots: (SlotEntry | null)[] = Array.from(
    { length: LIGHTNING_VISIBLE_SLOTS },
    (_, i) => {
      const item = shuffledRightItems[i];
      return item
        ? {
            pairId: item.pairId,
            text: item.portugueseText,
            state: 'idle',
          }
        : null;
    }
  );

  return {
    deck,
    nextQueueIdx: initialSlice.length,
    leftSlots,
    rightSlots,
  };
}

interface LightningMatchGameProps {
  pool: readonly NormalizedGameCard[];
  allReferenceCards: readonly NormalizedGameCard[];
  dailyCapReached: boolean;
  onCompleteMatch: (metrics: MiniGameSessionMetrics) => MiniGameXpAwardOutcome;
  onBackToArena: () => void;
  onOpenRankingModal?: () => void;
}

export const LightningMatchGame = memo(function LightningMatchGame({
  pool,
  allReferenceCards,
  dailyCapReached,
  onCompleteMatch,
  onBackToArena,
  onOpenRankingModal,
}: LightningMatchGameProps) {
  const [board, setBoard] = useState<BoardState>(() =>
    createInitialLightningBoard(pool, allReferenceCards)
  );
  const [selectedLeftSlot, setSelectedLeftSlot] = useState<number | null>(null);
  const [selectedRightSlot, setSelectedRightSlot] = useState<number | null>(null);
  const [mismatchSlots, setMismatchSlots] = useState<{
    left: number;
    right: number;
    key: number;
  } | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [speakOnMatch, setSpeakOnMatch] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [finishedOutcome, setFinishedOutcome] =
    useState<MiniGameXpAwardOutcome | null>(null);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(
    null
  );

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishedLockRef = useRef(false);

  const clearPendingTimers = useCallback(() => {
    for (const t of timersRef.current) {
      globalThis.clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTimers();
      stopCurrentAudio();
    };
  }, [clearPendingTimers]);

  // Match stopwatch
  useEffect(() => {
    if (isFinished) return;
    const interval = globalThis.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => globalThis.clearInterval(interval);
  }, [isFinished]);

  const finalizeMatch = useCallback(
    (totalPairs: number, totalMistakes: number) => {
      if (finishedLockRef.current) return;
      finishedLockRef.current = true;
      stopCurrentAudio();
      const outcome = onCompleteMatch({
        gameId: 'lightning-match',
        correctCount: totalPairs,
        totalItems: totalPairs,
        mistakesCount: totalMistakes,
      });
      setFinishedOutcome(outcome);
      if (outcome.awardedXp > 0) {
        setFloatingXp({ amount: outcome.awardedXp, key: Date.now() });
      }
      setIsFinished(true);
    },
    [onCompleteMatch]
  );

  const evaluatePairSelection = useCallback(
    (leftIdx: number, rightIdx: number) => {
      const leftEntry = board.leftSlots[leftIdx];
      const rightEntry = board.rightSlots[rightIdx];
      if (
        !leftEntry ||
        !rightEntry ||
        leftEntry.state !== 'idle' ||
        rightEntry.state !== 'idle'
      ) {
        return;
      }

      if (leftEntry.pairId === rightEntry.pairId) {
        // MATCH! Apply 180ms smooth green (#38E5A5) dissolve with zero layout shift
        setSelectedLeftSlot(null);
        setSelectedRightSlot(null);
        void triggerSuccess();

        if (speakOnMatch) {
          void speakEnglishText(leftEntry.text, 'us', {
            role: 'term',
            sourceId: `lightning-${leftEntry.pairId}`,
          });
        }

        setBoard((prev) => {
          const nextLeft = [...prev.leftSlots];
          const nextRight = [...prev.rightSlots];
          if (nextLeft[leftIdx]) {
            nextLeft[leftIdx] = { ...nextLeft[leftIdx]!, state: 'dissolving' };
          }
          if (nextRight[rightIdx]) {
            nextRight[rightIdx] = { ...nextRight[rightIdx]!, state: 'dissolving' };
          }
          return { ...prev, leftSlots: nextLeft, rightSlots: nextRight };
        });

        const dissolveTimer = globalThis.setTimeout(() => {
          setMatchedCount((prevMatched) => {
            const updatedMatched = prevMatched + 1;
            if (updatedMatched >= board.deck.length) {
              finalizeMatch(board.deck.length, mistakesCount);
            }
            return updatedMatched;
          });

          setBoard((prev) => {
            const nextLeft = [...prev.leftSlots];
            const nextRight = [...prev.rightSlots];
            nextLeft[leftIdx] = null;
            nextRight[rightIdx] = null;

            const emptyLeftIndices = nextLeft
              .map((s, idx) => (s === null ? idx : -1))
              .filter((idx) => idx >= 0);
            const emptyRightIndices = nextRight
              .map((s, idx) => (s === null ? idx : -1))
              .filter((idx) => idx >= 0);

            const remainingInQueue = prev.deck.length - prev.nextQueueIdx;
            // Refill in batches of >= 2 empty slots (or when <= 1 item remains in queue) so new pairs are cross-shuffled!
            if (
              remainingInQueue > 0 &&
              (emptyLeftIndices.length >= 2 || remainingInQueue === 1)
            ) {
              const batchSize = Math.min(
                emptyLeftIndices.length,
                emptyRightIndices.length,
                remainingInQueue
              );
              const incomingPairs = prev.deck.slice(
                prev.nextQueueIdx,
                prev.nextQueueIdx + batchSize
              );

              let shuffledRightIncoming = shuffleDeterministicOrRandom(incomingPairs);
              if (
                incomingPairs.length >= 2 &&
                shuffledRightIncoming.every(
                  (r, i) => r.pairId === incomingPairs[i]?.pairId
                )
              ) {
                shuffledRightIncoming = [
                  ...shuffledRightIncoming.slice(1),
                  shuffledRightIncoming[0],
                ];
              }

              for (let k = 0; k < batchSize; k++) {
                const lSlot = emptyLeftIndices[k];
                const rSlot = emptyRightIndices[k];
                const lPair = incomingPairs[k];
                const rPair = shuffledRightIncoming[k];
                nextLeft[lSlot] = {
                  pairId: lPair.pairId,
                  text: lPair.englishText,
                  subNote: lPair.contextualNote,
                  state: 'idle',
                };
                nextRight[rSlot] = {
                  pairId: rPair.pairId,
                  text: rPair.portugueseText,
                  state: 'idle',
                };
              }

              return {
                ...prev,
                nextQueueIdx: prev.nextQueueIdx + batchSize,
                leftSlots: nextLeft,
                rightSlots: nextRight,
              };
            }

            return {
              ...prev,
              leftSlots: nextLeft,
              rightSlots: nextRight,
            };
          });
        }, 185);

        timersRef.current.push(dissolveTimer);
      } else {
        // MISMATCH! Subtle 200ms 3px shake ONLY on the two clicked chips (zero red screen flash)
        void triggerError();
        setMistakesCount((m) => m + 1);
        const shakeToken = Date.now();
        setMismatchSlots({ left: leftIdx, right: rightIdx, key: shakeToken });

        const clearMismatchTimer = globalThis.setTimeout(() => {
          setSelectedLeftSlot(null);
          setSelectedRightSlot(null);
          setMismatchSlots((cur) => (cur?.key === shakeToken ? null : cur));
        }, 220);

        timersRef.current.push(clearMismatchTimer);
      }
    },
    [board, finalizeMatch, mistakesCount, speakOnMatch]
  );

  const handleTapLeft = useCallback(
    (slotIdx: number) => {
      if (mismatchSlots) return;
      const entry = board.leftSlots[slotIdx];
      if (!entry || entry.state !== 'idle') return;
      void triggerTap();

      if (selectedLeftSlot === slotIdx) {
        setSelectedLeftSlot(null);
        return;
      }

      setSelectedLeftSlot(slotIdx);
      if (selectedRightSlot !== null) {
        evaluatePairSelection(slotIdx, selectedRightSlot);
      }
    },
    [board.leftSlots, evaluatePairSelection, mismatchSlots, selectedLeftSlot, selectedRightSlot]
  );

  const handleTapRight = useCallback(
    (slotIdx: number) => {
      if (mismatchSlots) return;
      const entry = board.rightSlots[slotIdx];
      if (!entry || entry.state !== 'idle') return;
      void triggerTap();

      if (selectedRightSlot === slotIdx) {
        setSelectedRightSlot(null);
        return;
      }

      setSelectedRightSlot(slotIdx);
      if (selectedLeftSlot !== null) {
        evaluatePairSelection(selectedLeftSlot, slotIdx);
      }
    },
    [board.rightSlots, evaluatePairSelection, mismatchSlots, selectedLeftSlot, selectedRightSlot]
  );

  const handlePlayAgain = useCallback(() => {
    clearPendingTimers();
    stopCurrentAudio();
    finishedLockRef.current = false;
    setBoard(createInitialLightningBoard(pool, allReferenceCards));
    setSelectedLeftSlot(null);
    setSelectedRightSlot(null);
    setMismatchSlots(null);
    setMatchedCount(0);
    setMistakesCount(0);
    setElapsedSeconds(0);
    setFinishedOutcome(null);
    setIsFinished(false);
  }, [allReferenceCards, clearPendingTimers, pool]);

  if (isFinished) {
    return (
      <MiniGameResultSummary
        title="Memória Relâmpago Concluída!"
        subtitle={`${board.deck.length} pares conectados em ${elapsedSeconds}s.`}
        correctCount={board.deck.length}
        totalItems={board.deck.length}
        mistakesCount={mistakesCount}
        outcome={finishedOutcome}
        onPlayAgain={handlePlayAgain}
        onBackToArena={onBackToArena}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  const totalPairs = board.deck.length;
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = String(elapsedSeconds % 60).padStart(2, '0');

  return (
    <div className="max-w-2xl mx-auto space-y-4 ewm-pillar-enter select-none">
      <MiniGameTopHud
        title="Memória Relâmpago"
        subtitle="Conecte a expressão em inglês ao equivalente natural usado no Brasil"
        progressLabel={`${matchedCount} / ${totalPairs} pares`}
        floatingXp={floatingXp}
        dailyCapReached={dailyCapReached}
        onBackToArena={onBackToArena}
        rightBadge={
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void triggerTap();
                stopCurrentAudio();
                setSpeakOnMatch((v) => !v);
              }}
              aria-label={speakOnMatch ? 'Silenciar voz ao acertar par' : 'Ativar voz ao acertar par'}
              title={speakOnMatch ? 'Voz ao acertar ativa' : 'Voz silenciada'}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#28665E] dark:text-[#86CEC2] cursor-pointer"
            >
              {speakOnMatch ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 opacity-60" />
              )}
            </button>

            <span className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] font-mono-num text-xs font-semibold text-[#5C574E] dark:text-[#B9B4AA]">
              <Timer className="w-3.5 h-3.5" />
              <span>
                {mins}:{secs}
              </span>
            </span>
          </div>
        }
      />

      {/* Smooth Progress Bar */}
      <div className="h-2 rounded-full bg-[#E6E2D8] dark:bg-[#282E29] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#38E5A5] transition-all duration-200"
          style={{
            width: `${totalPairs > 0 ? Math.round((matchedCount / totalPairs) * 100) : 0}%`,
          }}
        />
      </div>

      {/* 2-Column Paired Grid (5 Fixed-Height Slots per Column => CLS Zero, Fits 360px Mobile) */}
      <div className="rounded-3xl border border-[#DFDAD0] dark:border-[#313831] bg-white dark:bg-[#202420] p-3 sm:p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 px-1 text-[11px] font-bold uppercase tracking-wider text-[#6B655C] dark:text-[#9FA7A1]">
          <span>🇺🇸 Inglês Natural</span>
          <span>🇧🇷 Português do Dia a Dia</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Left Column: English */}
          <div className="space-y-2">
            {board.leftSlots.map((slot, idx) => {
              if (!slot) {
                return (
                  <div
                    key={`left-empty-${idx}`}
                    aria-hidden="true"
                    className="h-[66px] sm:h-[68px] rounded-2xl border border-dashed border-[#ECE8DF] dark:border-[#292F2A] bg-[#FAF9F6]/40 dark:bg-[#1B1F1C]/40 flex items-center justify-center"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#38E5A5]/45" />
                  </div>
                );
              }

              const isSelected = selectedLeftSlot === idx;
              const isShaking = mismatchSlots?.left === idx;
              const isDissolving = slot.state === 'dissolving';

              return (
                <button
                  key={`left-${idx}-${slot.pairId}-${isShaking ? mismatchSlots?.key : 'ok'}`}
                  type="button"
                  disabled={isDissolving}
                  onClick={() => handleTapLeft(idx)}
                  className={`w-full h-[66px] sm:h-[68px] px-2.5 sm:px-3.5 py-2 rounded-2xl border text-left flex flex-col justify-center cursor-pointer overflow-hidden ${
                    isDissolving
                      ? 'ewm-match-dissolve border-[#38E5A5] bg-[#38E5A5]/25 text-[#0B3B2B] dark:text-[#D1FAE5]'
                      : isShaking
                      ? 'ewm-micro-shake border-[#D97706] bg-[#FEF3C7] dark:bg-[#382914] text-[#92400E] dark:text-[#FDE68A]'
                      : isSelected
                      ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#EAF3F1] dark:bg-[#1B332C] text-[#143D37] dark:text-[#E6FAF3] ring-2 ring-[#38E5A5]/35'
                      : 'border-[#E2DDD2] dark:border-[#343B35] bg-[#FAF9F6] hover:bg-[#F2F7F5] dark:bg-[#262B27] dark:hover:bg-[#2A332E] text-[#1C1B18] dark:text-[#F4F7F6]'
                  }`}
                >
                  <span className="text-[12px] sm:text-[13.5px] font-bold leading-tight line-clamp-2 break-words">
                    {slot.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Column: Brazilian Portuguese */}
          <div className="space-y-2">
            {board.rightSlots.map((slot, idx) => {
              if (!slot) {
                return (
                  <div
                    key={`right-empty-${idx}`}
                    aria-hidden="true"
                    className="h-[66px] sm:h-[68px] rounded-2xl border border-dashed border-[#ECE8DF] dark:border-[#292F2A] bg-[#FAF9F6]/40 dark:bg-[#1B1F1C]/40 flex items-center justify-center"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#38E5A5]/45" />
                  </div>
                );
              }

              const isSelected = selectedRightSlot === idx;
              const isShaking = mismatchSlots?.right === idx;
              const isDissolving = slot.state === 'dissolving';

              return (
                <button
                  key={`right-${idx}-${slot.pairId}-${isShaking ? mismatchSlots?.key : 'ok'}`}
                  type="button"
                  disabled={isDissolving}
                  onClick={() => handleTapRight(idx)}
                  className={`w-full h-[66px] sm:h-[68px] px-2.5 sm:px-3.5 py-2 rounded-2xl border text-left flex flex-col justify-center cursor-pointer overflow-hidden ${
                    isDissolving
                      ? 'ewm-match-dissolve border-[#38E5A5] bg-[#38E5A5]/25 text-[#0B3B2B] dark:text-[#D1FAE5]'
                      : isShaking
                      ? 'ewm-micro-shake border-[#D97706] bg-[#FEF3C7] dark:bg-[#382914] text-[#92400E] dark:text-[#FDE68A]'
                      : isSelected
                      ? 'border-[#28665E] dark:border-[#38E5A5] bg-[#EAF3F1] dark:bg-[#1B332C] text-[#143D37] dark:text-[#E6FAF3] ring-2 ring-[#38E5A5]/35'
                      : 'border-[#E2DDD2] dark:border-[#343B35] bg-[#FAF9F6] hover:bg-[#F2F7F5] dark:bg-[#262B27] dark:hover:bg-[#2A332E] text-[#1C1B18] dark:text-[#F4F7F6]'
                  }`}
                >
                  <span className="text-[12px] sm:text-[13px] font-semibold leading-tight line-clamp-2 break-words">
                    {slot.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
