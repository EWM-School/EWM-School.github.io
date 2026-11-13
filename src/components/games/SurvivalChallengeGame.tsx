import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Heart,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useAudioPlaybackState } from '../../hooks/useAudioPlaybackState';
import {
  triggerError,
  triggerSuccess,
  triggerTap,
} from '../../services/platform/hapticsService';
import {
  getSelectedVoiceLocale,
  speakEnglishText,
  stopCurrentAudio,
} from '../../services/platform/speechService';
import type { EnglishAccent } from '../../types/flashcard';
import {
  SURVIVAL_INITIAL_HEARTS,
  buildSurvivalChallenge,
  shuffleDeterministicOrRandom,
  type NormalizedGameCard,
  type SurvivalChallenge,
  type SurvivalOption,
} from '../../utils/gameContentNormalizer';
import type {
  MiniGameSessionMetrics,
  MiniGameXpAwardOutcome,
} from '../../utils/gameXpPolicy';
import { AudioStatusIcon } from '../CardAudioControls';
import { MiniGameResultSummary, MiniGameTopHud } from './MiniGameSharedUi';

interface SurvivalChallengeGameProps {
  pool: readonly NormalizedGameCard[];
  allReferenceCards: readonly NormalizedGameCard[];
  savedBestStreak: number;
  dailyCapReached: boolean;
  onCompleteMatch: (metrics: MiniGameSessionMetrics) => MiniGameXpAwardOutcome;
  onBackToArena: () => void;
  onOpenRankingModal?: () => void;
}

export const SurvivalChallengeGame = memo(function SurvivalChallengeGame({
  pool,
  allReferenceCards,
  savedBestStreak,
  dailyCapReached,
  onCompleteMatch,
  onBackToArena,
  onOpenRankingModal,
}: SurvivalChallengeGameProps) {
  const { getButtonState } = useAudioPlaybackState();

  const shuffledQueueRef = useRef<NormalizedGameCard[]>(
    shuffleDeterministicOrRandom(pool)
  );

  const pickCardAtStep = useCallback(
    (step: number): NormalizedGameCard => {
      if (step > 0 && step % shuffledQueueRef.current.length === 0) {
        shuffledQueueRef.current = shuffleDeterministicOrRandom(pool);
      }
      return shuffledQueueRef.current[step % shuffledQueueRef.current.length];
    },
    [pool]
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [challenge, setChallenge] = useState<SurvivalChallenge>(() =>
    buildSurvivalChallenge(pickCardAtStep(0), allReferenceCards, 0)
  );
  const challengeRef = useRef<SurvivalChallenge>(challenge);
  challengeRef.current = challenge;

  const [hearts, setHearts] = useState(SURVIVAL_INITIAL_HEARTS);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestRunStreak, setBestRunStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finishedOutcome, setFinishedOutcome] =
    useState<MiniGameXpAwardOutcome | null>(null);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(
    null
  );

  const autoSpokenIdRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);

  const isAnswered = selectedOptionId !== null;
  const liveAllTimeBest = Math.max(savedBestStreak, bestRunStreak);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  // Auto-play audio ONCE when a `listening` challenge opens, using the student's preferred accent
  const activeChallengeId = challenge.challengeId;
  useEffect(() => {
    const cur = challengeRef.current;
    if (isGameOver || cur.kind !== 'listening' || !cur.spokenText) return;
    if (autoSpokenIdRef.current === activeChallengeId) return;
    autoSpokenIdRef.current = activeChallengeId;

    const preferredAccent: EnglishAccent = getSelectedVoiceLocale() || cur.accent;
    void speakEnglishText(cur.spokenText, preferredAccent, {
      role: 'term',
      sourceId: `survival-audio-${preferredAccent}-${cur.challengeId}`,
    });
  }, [activeChallengeId, isGameOver]);

  const handlePlayListeningAccent = useCallback((accent: EnglishAccent) => {
    const cur = challengeRef.current;
    if (!cur.spokenText) return;
    void triggerTap();
    void speakEnglishText(cur.spokenText, accent, {
      role: cur.kind === 'cloze' ? 'sentence' : 'term',
      sourceId: `survival-audio-${accent}-${cur.challengeId}`,
    });
  }, []);

  const finishSurvivalRun = useCallback(
    (finalCorrect: number, finalMistakes: number, finalBestRun: number) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      stopCurrentAudio();
      const outcome = onCompleteMatch({
        gameId: 'survival',
        correctCount: finalCorrect,
        totalItems: Math.max(1, finalCorrect + finalMistakes),
        mistakesCount: finalMistakes,
        bestStreakInRun: finalBestRun,
      });
      setFinishedOutcome(outcome);
      if (outcome.awardedXp > 0) {
        setFloatingXp({ amount: outcome.awardedXp, key: Date.now() });
      }
      setIsGameOver(true);
    },
    [onCompleteMatch]
  );

  const handleBackAndSaveProgress = useCallback(() => {
    stopCurrentAudio();
    if (!finalizedRef.current && (correctCount >= 3 || bestRunStreak > savedBestStreak)) {
      finalizedRef.current = true;
      onCompleteMatch({
        gameId: 'survival',
        correctCount,
        totalItems: Math.max(1, correctCount + mistakesCount),
        mistakesCount,
        bestStreakInRun: bestRunStreak,
      });
    }
    onBackToArena();
  }, [bestRunStreak, correctCount, mistakesCount, onBackToArena, onCompleteMatch, savedBestStreak]);

  const handleSelectOption = useCallback(
    (opt: SurvivalOption) => {
      if (isAnswered || isGameOver) return;
      setSelectedOptionId(opt.id);

      if (opt.isCorrect) {
        const nextStreak = currentStreak + 1;
        const nextBestRun = Math.max(bestRunStreak, nextStreak);
        setCurrentStreak(nextStreak);
        setBestRunStreak(nextBestRun);
        setCorrectCount((c) => c + 1);
        void triggerSuccess();

        if (nextStreak > 0 && nextStreak % 5 === 0 && !dailyCapReached) {
          setFloatingXp({ amount: 2, key: Date.now() });
        }
      } else {
        setCurrentStreak(0);
        setMistakesCount((m) => m + 1);
        setHearts((h) => Math.max(0, h - 1));
        setShakeKey((k) => k + 1);
        void triggerError();
      }
    },
    [bestRunStreak, currentStreak, dailyCapReached, isAnswered, isGameOver]
  );

  const handleContinue = useCallback(() => {
    void triggerTap();
    stopCurrentAudio();

    if (hearts <= 0) {
      finishSurvivalRun(correctCount, mistakesCount, bestRunStreak);
      return;
    }

    const nextStep = stepIdx + 1;
    const nextCard = pickCardAtStep(nextStep);
    setStepIdx(nextStep);
    setSelectedOptionId(null);
    setChallenge(buildSurvivalChallenge(nextCard, allReferenceCards, nextStep));
  }, [
    allReferenceCards,
    bestRunStreak,
    correctCount,
    finishSurvivalRun,
    hearts,
    mistakesCount,
    pickCardAtStep,
    stepIdx,
  ]);

  const handlePlayAgain = useCallback(() => {
    stopCurrentAudio();
    finalizedRef.current = false;
    autoSpokenIdRef.current = null;
    shuffledQueueRef.current = shuffleDeterministicOrRandom(pool);
    const firstCard = shuffledQueueRef.current[0];
    setStepIdx(0);
    setChallenge(buildSurvivalChallenge(firstCard, allReferenceCards, 0));
    setHearts(SURVIVAL_INITIAL_HEARTS);
    setCurrentStreak(0);
    setBestRunStreak(0);
    setCorrectCount(0);
    setMistakesCount(0);
    setSelectedOptionId(null);
    setFinishedOutcome(null);
    setIsGameOver(false);
  }, [allReferenceCards, pool]);

  // Desktop shortcuts: [1..4] select option, [Enter] continue, [U]/[R] US audio, [K] UK audio
  useEffect(() => {
    if (isGameOver) return;
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
      if ((lower === 'r' || lower === 'u') && challenge.spokenText) {
        e.preventDefault();
        handlePlayListeningAccent('us');
        return;
      }
      if (lower === 'k' && challenge.spokenText) {
        e.preventDefault();
        handlePlayListeningAccent('uk');
        return;
      }

      if (isAnswered && e.key === 'Enter') {
        e.preventDefault();
        handleContinue();
        return;
      }

      const num = Number(e.key);
      if (!isAnswered && num >= 1 && num <= 4 && challenge.options[num - 1]) {
        e.preventDefault();
        handleSelectOption(challenge.options[num - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [challenge, handleContinue, handlePlayListeningAccent, handleSelectOption, isAnswered, isGameOver]);

  if (isGameOver) {
    const beatRecord = Boolean(finishedOutcome?.beatPreviousRecord);
    return (
      <MiniGameResultSummary
        title={
          beatRecord
            ? '🔥 Novo Recorde de Sobrevivência!'
            : 'Fim da Rodada de Sobrevivência'
        }
        subtitle={`Você alcançou uma sequência máxima de ${bestRunStreak} ${
          bestRunStreak === 1 ? 'acerto seguido' : 'acertos seguidos'
        } nesta sessão.`}
        correctCount={correctCount}
        totalItems={Math.max(1, correctCount + mistakesCount)}
        mistakesCount={mistakesCount}
        outcome={finishedOutcome}
        extraStatBadge={{
          label: beatRecord ? 'Novo Recorde!' : 'Recorde Pessoal',
          value: `${Math.max(liveAllTimeBest, finishedOutcome?.newSurvivalBestStreak ?? 0)}`,
          highlight: beatRecord,
        }}
        onPlayAgain={handlePlayAgain}
        onBackToArena={onBackToArena}
        onOpenRankingModal={onOpenRankingModal}
      />
    );
  }

  const chosenOption = challenge.options.find((o) => o.id === selectedOptionId);
  const wasRight = Boolean(chosenOption?.isCorrect);

  const usBtnState = challenge.spokenText
    ? getButtonState({
        text: challenge.spokenText,
        accent: 'us',
        sourceId: `survival-audio-us-${challenge.challengeId}`,
      })
    : 'idle';

  const ukBtnState = challenge.spokenText
    ? getButtonState({
        text: challenge.spokenText,
        accent: 'uk',
        sourceId: `survival-audio-uk-${challenge.challengeId}`,
      })
    : 'idle';

  return (
    <div
      data-challenge-id={challenge.challengeId}
      className="max-w-2xl mx-auto space-y-4 ewm-pillar-enter select-none"
    >
      <MiniGameTopHud
        title="Desafio Sobrevivência"
        subtitle="Mantenha suas 3 vidas e supere seu recorde pessoal de sequência"
        progressLabel={`Desafio #${stepIdx + 1}`}
        floatingXp={floatingXp}
        dailyCapReached={dailyCapReached}
        onBackToArena={handleBackAndSaveProgress}
        rightBadge={
          <div className="inline-flex items-center gap-2">
            {/* 3 Hearts HUD */}
            <div
              aria-label={`${hearts} de ${SURVIVAL_INITIAL_HEARTS} vidas restantes`}
              className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#F8C7CE] dark:border-[#FB7185]/30 bg-[#FFF5F6] dark:bg-[#28151B]"
            >
              {Array.from({ length: SURVIVAL_INITIAL_HEARTS }).map((_, idx) => {
                const alive = idx < hearts;
                return (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 transition-all ${
                      alive
                        ? 'text-[#F43F5E] fill-[#F43F5E] drop-shadow-[0_0_6px_rgba(244,63,94,0.45)]'
                        : 'text-[#CBD5E1] dark:text-[#475569] scale-90'
                    }`}
                  />
                );
              })}
            </div>

            {/* Combo Streak Pill */}
            <div className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#FDE68A] dark:border-[#FBBF24]/30 bg-[#FFFBEB] dark:bg-[#261E12] font-mono-num text-xs font-bold text-[#B45309] dark:text-[#FBBF24]">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{currentStreak}</span>
            </div>
          </div>
        }
      />

      {/* Personal Best Streak Bar */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl border border-[#DCE8E3] dark:border-[#38E5A5]/20 bg-white/90 dark:bg-[#131A22] text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#475550] dark:text-[#B5C4BE]">
          <Trophy className="w-3.5 h-3.5 text-[#D97706] dark:text-[#FBBF24]" />
          <span>Recorde Pessoal (Best Streak):</span>
        </span>
        <span className="font-mono-num font-extrabold text-[#B45309] dark:text-[#FBBF24]">
          🔥 {liveAllTimeBest}{' '}
          {currentStreak > 0 && currentStreak === liveAllTimeBest && currentStreak > savedBestStreak
            ? '· NOVO RECORDE!'
            : 'seguidos'}
        </span>
      </div>

      {/* Challenge Card */}
      <div
        key={`surv-card-${shakeKey}`}
        className={`rounded-3xl border border-[#D4E7DF] dark:border-[#38E5A5]/22 bg-white dark:bg-[#131A22] p-4 sm:p-6 shadow-xs space-y-5 ${
          shakeKey > 0 && isAnswered && !wasRight ? 'ewm-micro-shake' : ''
        }`}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#142E25] border border-[#00C982]/25 dark:border-[#38E5A5]/25 text-[#065F46] dark:text-[#38E5A5] text-[11px] font-bold">
              {challenge.promptTitlePt}
            </span>

            <span className="text-[11px] text-[#52605B] dark:text-[#94A9A1]">
              {challenge.card.category} · {challenge.card.subtopic}
            </span>
          </div>

          {challenge.kind === 'listening' && challenge.spokenText ? (
            <div className="rounded-2xl border border-[#BCE8D6] dark:border-[#38E5A5]/25 bg-gradient-to-br from-[#F1FBF7] to-[#E6F7F0] dark:from-[#142520] dark:to-[#0F1B18] p-4 flex flex-col items-center text-center space-y-3">
              <div className="w-full max-w-md grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="survival-listen-us"
                  aria-pressed={usBtnState !== 'idle'}
                  aria-busy={usBtnState === 'loading'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayListeningAccent('us');
                  }}
                  className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border cursor-pointer transition-all ${
                    usBtnState === 'loading'
                      ? 'ewm-audio-loading border-[#00C982] dark:border-[#38E5A5] bg-[#00C982] dark:bg-[#38E5A5] text-[#05291D]'
                      : usBtnState === 'playing'
                      ? 'ewm-audio-playing border-[#00C982] dark:border-[#38E5A5] bg-[#059669] dark:bg-[#10B981] text-white shadow-[0_0_14px_rgba(56,229,165,0.38)]'
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
                  data-testid="survival-listen-uk"
                  aria-pressed={ukBtnState !== 'idle'}
                  aria-busy={ukBtnState === 'loading'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayListeningAccent('uk');
                  }}
                  className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border cursor-pointer transition-all ${
                    ukBtnState === 'loading'
                      ? 'ewm-audio-loading border-[#38BDF8] bg-[#0284C7] text-white'
                      : ukBtnState === 'playing'
                      ? 'ewm-audio-playing border-[#38BDF8] bg-[#0284C7] text-white shadow-[0_0_14px_rgba(56,189,248,0.35)]'
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

              <p className="text-xs text-[#475550] dark:text-[#A7BDB5]">
                {challenge.promptPrimary}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#121816] dark:text-[#F4F9F7] leading-snug">
                &ldquo;{challenge.promptPrimary}&rdquo;
              </h3>
              {challenge.promptSecondaryPt && (
                <p className="text-xs sm:text-sm text-[#52605B] dark:text-[#9CB0A9]">
                  {challenge.kind === 'cloze'
                    ? `Sentido: ${challenge.promptSecondaryPt}`
                    : `Dica: ${challenge.promptSecondaryPt}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 4 Options */}
        <div className="space-y-2">
          {challenge.options.map((opt, idx) => {
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
                onClick={() => handleSelectOption(opt)}
                className={`w-full min-h-[48px] text-left px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default ${cls}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg border border-current/25 flex items-center justify-center text-xs font-mono-num font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold leading-snug">{opt.label}</span>
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

        {/* Immediate 1-Line Learning Feedback on Answer */}
        {isAnswered && (
          <div
            className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ewm-pillar-enter ${
              wasRight
                ? 'border-[#00C982]/60 dark:border-[#38E5A5]/60 bg-[#ECFDF5] dark:bg-[#122B22]'
                : 'border-[#FECDD3] dark:border-[#FB7185]/35 bg-[#FFF1F2] dark:bg-[#2B171E]'
            }`}
          >
            <p className="text-xs sm:text-[13px] font-semibold text-[#121816] dark:text-[#F4F9F7] flex-1 min-w-[200px]">
              {wasRight
                ? `🔥 Sequência em ${currentStreak}! ${challenge.explanationLinePt}`
                : `💔 -1 vida · ${challenge.explanationLinePt}`}
            </p>

            <button
              type="button"
              onClick={handleContinue}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00C982] hover:bg-[#05B374] dark:bg-[#38E5A5] dark:hover:bg-[#2AD394] text-[#05291D] text-xs sm:text-sm font-bold cursor-pointer ml-auto shadow-[0_0_14px_rgba(56,229,165,0.28)]"
            >
              <span>{hearts <= 0 ? 'Ver Placar Final' : 'Próximo Desafio'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
