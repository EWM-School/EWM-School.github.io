import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Ear, XCircle } from 'lucide-react';
import { useAudioPlaybackState } from '../../hooks/useAudioPlaybackState';
import {
  triggerError,
  triggerSuccess,
  triggerTap,
} from '../../services/platform/hapticsService';
import {
  speakEnglishText,
  stopCurrentAudio,
} from '../../services/platform/speechService';
import type { EnglishAccent } from '../../types/flashcard';
import {
  NATIVE_EAR_QUESTIONS_PER_MATCH,
  NATIVE_EAR_SECONDS_PER_QUESTION,
  buildNativeEarQuestions,
  type NativeEarAccentMode,
  type NativeEarOption,
  type NativeEarQuestion,
  type NormalizedGameCard,
} from '../../utils/gameContentNormalizer';
import type {
  MiniGameSessionMetrics,
  MiniGameXpAwardOutcome,
} from '../../utils/gameXpPolicy';
import { AudioStatusIcon } from '../CardAudioControls';
import { MiniGameResultSummary, MiniGameTopHud } from './MiniGameSharedUi';

interface NativeEarGameProps {
  pool: readonly NormalizedGameCard[];
  allReferenceCards: readonly NormalizedGameCard[];
  dailyCapReached: boolean;
  onCompleteMatch: (metrics: MiniGameSessionMetrics) => MiniGameXpAwardOutcome;
  onBackToArena: () => void;
  onOpenRankingModal?: () => void;
}

const ACCENT_MODES: { key: NativeEarAccentMode; label: string }[] = [
  { key: 'mixed', label: '🌎 Misto Realista' },
  { key: 'us', label: '🇺🇸 Auto US' },
  { key: 'uk', label: '🇬🇧 Auto UK' },
];

export const NativeEarGame = memo(function NativeEarGame({
  pool,
  allReferenceCards,
  dailyCapReached,
  onCompleteMatch,
  onBackToArena,
  onOpenRankingModal,
}: NativeEarGameProps) {
  const { activeAudio, getButtonState } = useAudioPlaybackState();

  const [accentMode, setAccentMode] = useState<NativeEarAccentMode>('mixed');
  const accentModeRef = useRef<NativeEarAccentMode>('mixed');

  // Round deck is generated ONCE on mount (and only reset on explicit "Jogar Novamente").
  // Switching accent or replaying audio NEVER mutates or regenerates `questions` or `qIdx`!
  const [questions, setQuestions] = useState<NativeEarQuestion[]>(() =>
    buildNativeEarQuestions(
      pool,
      allReferenceCards,
      'mixed',
      NATIVE_EAR_QUESTIONS_PER_MATCH
    )
  );
  const [qIdx, setQIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(NATIVE_EAR_SECONDS_PER_QUESTION);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finishedOutcome, setFinishedOutcome] =
    useState<MiniGameXpAwardOutcome | null>(null);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(
    null
  );

  const currentQuestion = questions[qIdx] ?? null;
  const currentQuestionRef = useRef<NativeEarQuestion | null>(currentQuestion);
  currentQuestionRef.current = currentQuestion;

  const isAnswered = selectedOptionId !== null || timedOut;
  const isAudioLoading = activeAudio?.status === 'loading';

  const autoSpokenQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  // Auto-play neural audio ONCE when a new `questionId` opens (never re-runs on accent toggle or audio replay)
  const activeQuestionId = currentQuestion?.questionId ?? null;
  useEffect(() => {
    const q = currentQuestionRef.current;
    if (isFinished || !q || !activeQuestionId) return;
    if (autoSpokenQuestionIdRef.current === activeQuestionId) return;
    autoSpokenQuestionIdRef.current = activeQuestionId;

    const initialAccent: EnglishAccent =
      accentModeRef.current === 'mixed' ? q.accent : accentModeRef.current;

    void speakEnglishText(q.spokenText, initialAccent, {
      role: 'term',
      sourceId: `native-ear-${initialAccent}-${q.questionId}`,
    });
  }, [activeQuestionId, isFinished]);

  // Balanced 12s countdown per round (pauses cleanly while cold-start neural TTS is loading!)
  useEffect(() => {
    if (isFinished || !activeQuestionId || isAnswered || isAudioLoading) return;

    const timer = globalThis.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          globalThis.clearInterval(timer);
          setTimedOut(true);
          setMistakesCount((m) => m + 1);
          setShakeKey((k) => k + 1);
          void triggerError();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => globalThis.clearInterval(timer);
  }, [activeQuestionId, isAnswered, isAudioLoading, isFinished]);

  // Switching auto-play preference NEVER changes the current card, options, or round index!
  const handleSelectAccentMode = useCallback(
    (nextMode: NativeEarAccentMode) => {
      void triggerTap();
      accentModeRef.current = nextMode;
      setAccentMode(nextMode);

      const q = currentQuestionRef.current;
      if (q && (nextMode === 'us' || nextMode === 'uk')) {
        void speakEnglishText(q.spokenText, nextMode, {
          role: 'term',
          sourceId: `native-ear-${nextMode}-${q.questionId}`,
        });
      }
    },
    []
  );

  const handlePlayAccent = useCallback(
    (accent: EnglishAccent) => {
      const q = currentQuestionRef.current;
      if (!q) return;
      void triggerTap();
      void speakEnglishText(q.spokenText, accent, {
        role: 'term',
        sourceId: `native-ear-${accent}-${q.questionId}`,
      });
    },
    []
  );

  const handleChooseOption = useCallback(
    (opt: NativeEarOption) => {
      if (isAnswered || !currentQuestion) return;
      setSelectedOptionId(opt.id);
      if (opt.isCorrect) {
        setCorrectCount((c) => c + 1);
        void triggerSuccess();
      } else {
        setMistakesCount((m) => m + 1);
        setShakeKey((k) => k + 1);
        void triggerError();
      }
    },
    [currentQuestion, isAnswered]
  );

  const handleNextQuestion = useCallback(() => {
    if (!currentQuestion) return;
    void triggerTap();
    stopCurrentAudio();

    if (qIdx + 1 >= questions.length) {
      const outcome = onCompleteMatch({
        gameId: 'native-ear',
        correctCount,
        totalItems: questions.length,
        mistakesCount,
      });
      setFinishedOutcome(outcome);
      if (outcome.awardedXp > 0) {
        setFloatingXp({ amount: outcome.awardedXp, key: Date.now() });
      }
      setIsFinished(true);
      return;
    }

    setQIdx((i) => i + 1);
    setSecondsLeft(NATIVE_EAR_SECONDS_PER_QUESTION);
    setSelectedOptionId(null);
    setTimedOut(false);
  }, [correctCount, currentQuestion, mistakesCount, onCompleteMatch, qIdx, questions.length]);

  const handlePlayAgain = useCallback(() => {
    stopCurrentAudio();
    autoSpokenQuestionIdRef.current = null;
    setQuestions(
      buildNativeEarQuestions(
        pool,
        allReferenceCards,
        accentModeRef.current,
        NATIVE_EAR_QUESTIONS_PER_MATCH
      )
    );
    setQIdx(0);
    setSecondsLeft(NATIVE_EAR_SECONDS_PER_QUESTION);
    setSelectedOptionId(null);
    setTimedOut(false);
    setCorrectCount(0);
    setMistakesCount(0);
    setFinishedOutcome(null);
    setIsFinished(false);
  }, [allReferenceCards, pool]);

  // Desktop shortcuts: [U] hear US, [K] hear UK, [R] replay US, [1..4] select option, [Enter] next
  useEffect(() => {
    if (isFinished || !currentQuestion) return;
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

      const lower = e.key.toLowerCase();
      if (lower === 'u' || lower === 'r') {
        e.preventDefault();
        handlePlayAccent('us');
        return;
      }
      if (lower === 'k') {
        e.preventDefault();
        handlePlayAccent('uk');
        return;
      }

      if (isAnswered && e.key === 'Enter') {
        e.preventDefault();
        handleNextQuestion();
        return;
      }

      const num = Number(e.key);
      if (!isAnswered && num >= 1 && num <= 4 && currentQuestion.options[num - 1]) {
        e.preventDefault();
        handleChooseOption(currentQuestion.options[num - 1]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentQuestion, handleChooseOption, handleNextQuestion, handlePlayAccent, isAnswered, isFinished]);

  if (isFinished) {
    return (
      <MiniGameResultSummary
        title="Ouvido de Nativo Concluído!"
        subtitle={`Compreensão auditiva treinada com liberdade total 🇺🇸 US & 🇬🇧 UK.`}
        correctCount={correctCount}
        totalItems={questions.length}
        mistakesCount={mistakesCount}
        outcome={finishedOutcome}
        onPlayAgain={handlePlayAgain}
        onBackToArena={onBackToArena}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  if (!currentQuestion) return null;

  const usBtnState = getButtonState({
    text: currentQuestion.spokenText,
    accent: 'us',
    sourceId: `native-ear-us-${currentQuestion.questionId}`,
  });

  const ukBtnState = getButtonState({
    text: currentQuestion.spokenText,
    accent: 'uk',
    sourceId: `native-ear-uk-${currentQuestion.questionId}`,
  });

  const chosenOption = currentQuestion.options.find((o) => o.id === selectedOptionId);
  const wasRight = Boolean(chosenOption?.isCorrect);

  return (
    <div
      data-round-id={currentQuestion.questionId}
      className="max-w-2xl mx-auto space-y-4 ewm-pillar-enter select-none"
    >
      <MiniGameTopHud
        title="Ouvido de Nativo · US & UK"
        subtitle="Compreensão auditiva pura: ouça em US ou UK quantas vezes quiser antes de responder"
        progressLabel={`${qIdx + 1} / ${questions.length}`}
        floatingXp={floatingXp}
        dailyCapReached={dailyCapReached}
        onBackToArena={onBackToArena}
        rightBadge={
          <span
            title={isAudioLoading ? 'Cronômetro pausado enquanto a voz carrega' : undefined}
            className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border font-mono-num text-xs font-bold ${
              isAudioLoading
                ? 'border-[#38E5A5]/45 bg-[#ECFDF5] dark:bg-[#132920] text-[#059669] dark:text-[#38E5A5]'
                : secondsLeft <= 4 && !isAnswered
                ? 'border-[#DC2626]/50 bg-[#FEF2F2] dark:bg-[#311C1C] text-[#B91C1C] dark:text-[#FCA5A5]'
                : 'border-[#B8E6D4] dark:border-[#38E5A5]/25 bg-[#F2FBF7] dark:bg-[#13231E] text-[#0F6E52] dark:text-[#6EE7B7]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isAudioLoading ? `${secondsLeft}s ⏸` : `${secondsLeft}s`}</span>
          </span>
        }
      />

      {/* Auto-Play Accent Preference Pills (Never resets or swaps the active card!) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl border border-[#D8E8E2] dark:border-[#38E5A5]/20 bg-white dark:bg-[#131A22]">
          {ACCENT_MODES.map((m) => {
            const active = accentMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAccentMode(m.key);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer ${
                  active
                    ? 'bg-[#00C982] dark:bg-[#38E5A5] text-[#06281D] font-bold shadow-2xs'
                    : 'text-[#525E5A] dark:text-[#B5C4BE] hover:text-[#121816] dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <span className="text-xs font-mono-num text-[#525E5A] dark:text-[#9CB0A9]">
          Acertos: <strong className="text-[#059669] dark:text-[#38E5A5]">{correctCount}</strong>
        </span>
      </div>

      {/* Main Listening Card */}
      <div
        key={`ear-card-${shakeKey}`}
        className={`rounded-3xl border border-[#D4E7DF] dark:border-[#38E5A5]/22 bg-white dark:bg-[#131A22] p-4 sm:p-6 shadow-xs space-y-5 ${
          shakeKey > 0 && isAnswered && !wasRight ? 'ewm-micro-shake' : ''
        }`}
      >
        {/* Dual Independent US & UK Pure-Listening Controls */}
        <div className="rounded-2xl border border-[#BCE8D6] dark:border-[#38E5A5]/25 bg-gradient-to-br from-[#F1FBF7] to-[#E6F7F0] dark:from-[#142520] dark:to-[#0F1B18] p-4 sm:p-5 flex flex-col items-center text-center space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/90 dark:bg-[#192F29] border border-[#00C982]/25 dark:border-[#38E5A5]/25 text-[11px] font-bold text-[#0D6B4F] dark:text-[#38E5A5]">
            <Ear className="w-3.5 h-3.5" />
            <span>Compare livremente os dois sotaques nesta carta</span>
          </div>

          <div className="w-full max-w-md grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              data-testid="native-ear-btn-us"
              aria-pressed={usBtnState !== 'idle'}
              aria-busy={usBtnState === 'loading'}
              onClick={(e) => {
                e.stopPropagation();
                handlePlayAccent('us');
              }}
              className={`min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border shadow-2xs cursor-pointer transition-all ${
                usBtnState === 'loading'
                  ? 'ewm-audio-loading border-[#00C982] dark:border-[#38E5A5] bg-[#00C982] dark:bg-[#38E5A5] text-[#05291D]'
                  : usBtnState === 'playing'
                  ? 'ewm-audio-playing border-[#00C982] dark:border-[#38E5A5] bg-[#059669] dark:bg-[#10B981] text-white shadow-[0_0_16px_rgba(56,229,165,0.4)]'
                  : 'border-[#00C982]/40 dark:border-[#38E5A5]/35 bg-white hover:bg-[#ECFDF5] dark:bg-[#182924] dark:hover:bg-[#1E352E] text-[#0F3D30] dark:text-[#ECFDF5]'
              }`}
            >
              <AudioStatusIcon
                state={usBtnState}
                idleClassName="w-4 h-4 text-[#059669] dark:text-[#38E5A5]"
                activeClassName="w-4 h-4"
              />
              <span>🇺🇸 Ouvir US</span>
            </button>

            <button
              type="button"
              data-testid="native-ear-btn-uk"
              aria-pressed={ukBtnState !== 'idle'}
              aria-busy={ukBtnState === 'loading'}
              onClick={(e) => {
                e.stopPropagation();
                handlePlayAccent('uk');
              }}
              className={`min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border shadow-2xs cursor-pointer transition-all ${
                ukBtnState === 'loading'
                  ? 'ewm-audio-loading border-[#38BDF8] bg-[#0284C7] text-white'
                  : ukBtnState === 'playing'
                  ? 'ewm-audio-playing border-[#38BDF8] bg-[#0284C7] text-white shadow-[0_0_16px_rgba(56,189,248,0.38)]'
                  : 'border-[#38BDF8]/40 dark:border-[#38BDF8]/35 bg-white hover:bg-[#F0F9FF] dark:bg-[#16242E] dark:hover:bg-[#1C2F3C] text-[#0C4A6E] dark:text-[#E0F2FE]'
              }`}
            >
              <AudioStatusIcon
                state={ukBtnState}
                idleClassName="w-4 h-4 text-[#0284C7] dark:text-[#38BDF8]"
                activeClassName="w-4 h-4"
              />
              <span>🇬🇧 Ouvir UK</span>
            </button>
          </div>

          {!isAnswered ? (
            <p className="text-xs text-[#475550] dark:text-[#A7BDB5]">
              Grafia oculta até sua resposta · clique em US ou UK quantas vezes precisar
            </p>
          ) : (
            <div className="pt-1 space-y-0.5 ewm-pillar-enter">
              <p className="font-display text-lg sm:text-xl font-bold text-[#121816] dark:text-[#F4F9F7]">
                {currentQuestion.card.primaryTerm}
              </p>
              <p className="text-xs font-mono-num text-[#0D6B4F] dark:text-[#38E5A5]">
                US {currentQuestion.card.phoneticUs} · UK {currentQuestion.card.phoneticUk}
              </p>
            </div>
          )}
        </div>

        {/* 4 Collision-Free Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((opt, idx) => {
            let cls =
              'border-[#DDE8E3] dark:border-[#263340] bg-[#F8FBFA] dark:bg-[#19222C] text-[#121816] dark:text-[#EEF4F2] hover:border-[#00C982] dark:hover:border-[#38E5A5]/60';
            if (isAnswered) {
              if (opt.isCorrect) {
                cls =
                  'border-[#00C982] dark:border-[#38E5A5] bg-[#ECFDF5] dark:bg-[#132E24] text-[#064E3B] dark:text-[#D1FAE5] shadow-[0_0_14px_rgba(56,229,165,0.2)]';
              } else if (opt.id === selectedOptionId) {
                cls =
                  'border-[#E11D48]/70 bg-[#FFF1F2] dark:bg-[#311820] text-[#9F1239] dark:text-[#FECDD3]';
              } else {
                cls =
                  'border-[#E8EEEB] dark:border-[#1E2832] bg-[#F8FBFA]/60 dark:bg-[#151D26] text-[#83918C] dark:text-[#6B7A88] opacity-65';
              }
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={isAnswered}
                onClick={() => handleChooseOption(opt)}
                className={`w-full min-h-[48px] text-left px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default ${cls}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg border border-current/25 flex items-center justify-center text-xs font-mono-num font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold leading-snug">{opt.labelPt}</span>
                </div>

                {isAnswered && opt.isCorrect && (
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#10B981] dark:text-[#38E5A5] shrink-0" />
                )}
                {isAnswered && opt.id === selectedOptionId && !opt.isCorrect && (
                  <XCircle className="w-4.5 h-4.5 text-[#E11D48] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Educational Reveal Footer */}
        {isAnswered && (
          <div className="rounded-2xl border border-[#D4E7DF] dark:border-[#38E5A5]/22 bg-[#F4FBF8] dark:bg-[#101820] p-3.5 flex flex-wrap items-center justify-between gap-3 ewm-pillar-enter">
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-[#121816] dark:text-[#F4F9F7]">
                {timedOut
                  ? '⏱️ Tempo esgotado!'
                  : wasRight
                  ? '✅ Escuta certeira!'
                  : '💡 Confira a grafia e o sentido:'}{' '}
                <span className="text-[#059669] dark:text-[#38E5A5]">
                  {currentQuestion.card.primaryTerm}
                </span>{' '}
                → {currentQuestion.card.primaryPt}
              </p>
              {currentQuestion.card.cleanExampleEn && (
                <p className="text-[#525E5A] dark:text-[#9CB0A9] italic">
                  &ldquo;{currentQuestion.card.cleanExampleEn}&rdquo;
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextQuestion}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00C982] hover:bg-[#05B374] dark:bg-[#38E5A5] dark:hover:bg-[#2AD394] text-[#05291D] text-xs sm:text-sm font-bold cursor-pointer ml-auto shadow-[0_0_14px_rgba(56,229,165,0.28)]"
            >
              <span>
                {qIdx + 1 >= questions.length ? 'Ver Resultado' : 'Próximo Áudio'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
