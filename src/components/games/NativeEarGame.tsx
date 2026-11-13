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
  toggleSpeakEnglishText,
} from '../../services/platform/speechService';
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
  { key: 'us', label: '🇺🇸 US' },
  { key: 'uk', label: '🇬🇧 UK' },
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
  const isAnswered = selectedOptionId !== null || timedOut;
  const isAudioLoading = activeAudio?.status === 'loading';

  const autoSpokenQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  // Immediately play pure neural audio when each round starts
  useEffect(() => {
    if (isFinished || !currentQuestion) return;
    if (autoSpokenQuestionIdRef.current === currentQuestion.questionId) return;
    autoSpokenQuestionIdRef.current = currentQuestion.questionId;

    void speakEnglishText(currentQuestion.spokenText, currentQuestion.accent, {
      role: 'term',
      sourceId: `native-ear-replay-${currentQuestion.questionId}`,
    });
  }, [currentQuestion, isFinished]);

  // Balanced 12s countdown per round (pauses cleanly while neural TTS is loading on cold start!)
  useEffect(() => {
    if (isFinished || !currentQuestion || isAnswered || isAudioLoading) return;

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
  }, [currentQuestion, isAnswered, isAudioLoading, isFinished]);

  const handleSelectAccentMode = useCallback(
    (nextMode: NativeEarAccentMode) => {
      if (nextMode === accentMode) return;
      void triggerTap();
      stopCurrentAudio();
      autoSpokenQuestionIdRef.current = null;
      setAccentMode(nextMode);
      setQuestions(
        buildNativeEarQuestions(
          pool,
          allReferenceCards,
          nextMode,
          NATIVE_EAR_QUESTIONS_PER_MATCH
        )
      );
      setQIdx(0);
      setSecondsLeft(NATIVE_EAR_SECONDS_PER_QUESTION);
      setSelectedOptionId(null);
      setTimedOut(false);
      setCorrectCount(0);
      setMistakesCount(0);
      setIsFinished(false);
      setFinishedOutcome(null);
    },
    [accentMode, allReferenceCards, pool]
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
        accentMode,
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
  }, [accentMode, allReferenceCards, pool]);

  // Desktop shortcuts: [R] replay audio, [1..4] select option, [Enter] next
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

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void toggleSpeakEnglishText(currentQuestion.spokenText, currentQuestion.accent, {
          role: 'term',
          sourceId: `native-ear-replay-${currentQuestion.questionId}`,
        });
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
  }, [currentQuestion, handleChooseOption, handleNextQuestion, isAnswered, isFinished]);

  if (isFinished) {
    return (
      <MiniGameResultSummary
        title="Ouvido de Nativo Concluído!"
        subtitle={`Compreensão auditiva treinada no modo ${
          accentMode === 'us' ? '🇺🇸 US' : accentMode === 'uk' ? '🇬🇧 UK' : '🌎 Misto US & UK'
        }.`}
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

  const replayState = getButtonState({
    text: currentQuestion.spokenText,
    accent: currentQuestion.accent,
    sourceId: `native-ear-replay-${currentQuestion.questionId}`,
  });

  const chosenOption = currentQuestion.options.find((o) => o.id === selectedOptionId);
  const wasRight = Boolean(chosenOption?.isCorrect);

  return (
    <div className="max-w-2xl mx-auto space-y-4 ewm-pillar-enter select-none">
      <MiniGameTopHud
        title="Ouvido de Nativo · US & UK"
        subtitle="Compreensão auditiva pura: ouça sem ler e identifique o sentido natural"
        progressLabel={`${qIdx + 1} / ${questions.length}`}
        floatingXp={floatingXp}
        dailyCapReached={dailyCapReached}
        onBackToArena={onBackToArena}
        rightBadge={
          <span
            className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border font-mono-num text-xs font-bold ${
              secondsLeft <= 4 && !isAnswered
                ? 'border-[#DC2626]/50 bg-[#FEF2F2] dark:bg-[#311C1C] text-[#B91C1C] dark:text-[#FCA5A5]'
                : 'border-[#C6DBD7] dark:border-[#2F4B46] bg-[#F2F8F6] dark:bg-[#1B2A26] text-[#225851] dark:text-[#86CEC2]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{secondsLeft}s</span>
          </span>
        }
      />

      {/* Accent Selector Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl border border-[#E4E0D8] dark:border-[#2C332E] bg-white dark:bg-[#1F2420]">
          {ACCENT_MODES.map((m) => {
            const active = accentMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => handleSelectAccentMode(m.key)}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer ${
                  active
                    ? 'bg-[#28665E] text-white shadow-2xs'
                    : 'text-[#5C574E] dark:text-[#B5C0B9] hover:text-[#1C1B18] dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <span className="text-xs font-mono-num text-[#6B655C] dark:text-[#9CA49E]">
          Acertos: <strong>{correctCount}</strong>
        </span>
      </div>

      {/* Main Listening Card */}
      <div
        key={`ear-card-${shakeKey}`}
        className={`rounded-3xl border border-[#DFDAD0] dark:border-[#313831] bg-white dark:bg-[#202420] p-4 sm:p-6 shadow-xs space-y-5 ${
          shakeKey > 0 && isAnswered && !wasRight ? 'ewm-micro-shake' : ''
        }`}
      >
        {/* Big Pure-Listening Audio Trigger */}
        <div className="rounded-2xl border border-[#C6DBD7] dark:border-[#2B433D] bg-gradient-to-br from-[#F3FAF8] to-[#E8F3F0] dark:from-[#192824] dark:to-[#15221E] p-4 sm:p-5 flex flex-col items-center text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-[#22332E] text-[11px] font-bold text-[#225851] dark:text-[#86CEC2]">
            <Ear className="w-3.5 h-3.5" />
            <span>
              Sotaque desta rodada:{' '}
              {currentQuestion.accent === 'uk' ? '🇬🇧 Britânico (UK)' : '🇺🇸 Americano (US)'}
            </span>
          </div>

          <button
            type="button"
            aria-pressed={replayState !== 'idle'}
            aria-busy={replayState === 'loading'}
            onClick={() => {
              void triggerTap();
              void toggleSpeakEnglishText(
                currentQuestion.spokenText,
                currentQuestion.accent,
                {
                  role: 'term',
                  sourceId: `native-ear-replay-${currentQuestion.questionId}`,
                }
              );
            }}
            className={`min-h-[52px] inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold shadow-xs cursor-pointer ${
              replayState === 'loading'
                ? 'ewm-audio-loading bg-[#28665E] text-white'
                : replayState === 'playing'
                ? 'ewm-audio-playing bg-[#1F524B] text-white'
                : 'bg-[#28665E] hover:bg-[#1F524B] text-white'
            }`}
          >
            <AudioStatusIcon
              state={replayState}
              idleClassName="w-5 h-5"
              activeClassName="w-5 h-4"
            />
            <span>
              {replayState === 'loading'
                ? 'Carregando voz neural...'
                : replayState === 'playing'
                ? 'Ouvindo expressão...'
                : '🔊 Repetir Áudio'}
            </span>
          </button>

          {!isAnswered ? (
            <p className="text-xs text-[#524E46] dark:text-[#AFC0B8]">
              Grafia oculta até sua resposta para treinar escuta real
            </p>
          ) : (
            <div className="pt-1 space-y-0.5 ewm-pillar-enter">
              <p className="font-display text-lg sm:text-xl font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                {currentQuestion.card.primaryTerm}
              </p>
              <p className="text-xs font-mono-num text-[#225851] dark:text-[#86CEC2]">
                US {currentQuestion.card.phoneticUs} · UK {currentQuestion.card.phoneticUk}
              </p>
            </div>
          )}
        </div>

        {/* 4 Collision-Free Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((opt, idx) => {
            let cls =
              'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#282D28] text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E]/55';
            if (isAnswered) {
              if (opt.isCorrect) {
                cls =
                  'border-[#38E5A5] bg-[#ECFDF5] dark:bg-[#183127] text-[#0F5132] dark:text-[#C5ECDA]';
              } else if (opt.id === selectedOptionId) {
                cls =
                  'border-[#B5443C] bg-[#FDF2F2] dark:bg-[#311F1E] text-[#8F312B] dark:text-[#F4BCB8]';
              } else {
                cls =
                  'border-[#ECE9E1] dark:border-[#2A2F2A] bg-[#FAF9F6]/60 dark:bg-[#212421] text-[#857F74] dark:text-[#7D786F] opacity-65';
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
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#10B981] shrink-0" />
                )}
                {isAnswered && opt.id === selectedOptionId && !opt.isCorrect && (
                  <XCircle className="w-4.5 h-4.5 text-[#B5443C] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Educational Reveal Footer */}
        {isAnswered && (
          <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#303831] bg-[#FAF9F6] dark:bg-[#1B201C] p-3.5 flex flex-wrap items-center justify-between gap-3 ewm-pillar-enter">
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-[#1C1B18] dark:text-[#F4F7F6]">
                {timedOut
                  ? '⏱️ Tempo esgotado!'
                  : wasRight
                  ? '✅ Escuta certeira!'
                  : '💡 Confira a grafia e o sentido:'}{' '}
                <span className="text-[#28665E] dark:text-[#38E5A5]">
                  {currentQuestion.card.primaryTerm}
                </span>{' '}
                → {currentQuestion.card.primaryPt}
              </p>
              {currentQuestion.card.cleanExampleEn && (
                <p className="text-[#6B655C] dark:text-[#A0A8A2] italic">
                  &ldquo;{currentQuestion.card.cleanExampleEn}&rdquo;
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextQuestion}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white text-xs sm:text-sm font-semibold cursor-pointer ml-auto"
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
