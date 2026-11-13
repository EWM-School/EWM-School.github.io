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
  speakEnglishText,
  stopCurrentAudio,
  toggleSpeakEnglishText,
} from '../../services/platform/speechService';
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

  // Auto-play audio when a `listening` challenge appears
  useEffect(() => {
    if (isGameOver || challenge.kind !== 'listening' || !challenge.spokenText) return;
    if (autoSpokenIdRef.current === challenge.challengeId) return;
    autoSpokenIdRef.current = challenge.challengeId;

    void speakEnglishText(challenge.spokenText, challenge.accent, {
      role: 'term',
      sourceId: `survival-audio-${challenge.challengeId}`,
    });
  }, [challenge, isGameOver]);

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

  // Desktop shortcuts: [1..4] select option, [Enter] continue, [R] replay audio
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

      if (e.key.toLowerCase() === 'r' && challenge.spokenText) {
        e.preventDefault();
        void toggleSpeakEnglishText(challenge.spokenText, challenge.accent, {
          role: challenge.kind === 'cloze' ? 'sentence' : 'term',
          sourceId: `survival-audio-${challenge.challengeId}`,
        });
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
  }, [challenge, handleContinue, handleSelectOption, isAnswered, isGameOver]);

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

  const audioBtnState = challenge.spokenText
    ? getButtonState({
        text: challenge.spokenText,
        accent: challenge.accent,
        sourceId: `survival-audio-${challenge.challengeId}`,
      })
    : 'idle';

  return (
    <div className="max-w-2xl mx-auto space-y-4 ewm-pillar-enter select-none">
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
              className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#F3D2CF] dark:border-[#4A2624] bg-[#FFF8F7] dark:bg-[#281918]"
            >
              {Array.from({ length: SURVIVAL_INITIAL_HEARTS }).map((_, idx) => {
                const alive = idx < hearts;
                return (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 transition-all ${
                      alive
                        ? 'text-[#E11D48] fill-[#E11D48]'
                        : 'text-[#C8C2B8] dark:text-[#4B463F] scale-90'
                    }`}
                  />
                );
              })}
            </div>

            {/* Combo Streak Pill */}
            <div className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-[#EAD9B8] dark:border-[#4A3B22] bg-[#FFFDF8] dark:bg-[#262016] font-mono-num text-xs font-bold text-[#B45309] dark:text-[#FBBF24]">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{currentStreak}</span>
            </div>
          </div>
        }
      />

      {/* Personal Best Streak Bar */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl border border-[#E6E2D8] dark:border-[#2C332E] bg-white/80 dark:bg-[#1E231F] text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#5C574E] dark:text-[#B5C0B9]">
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
        className={`rounded-3xl border border-[#DFDAD0] dark:border-[#313831] bg-white dark:bg-[#202420] p-4 sm:p-6 shadow-xs space-y-5 ${
          shakeKey > 0 && isAnswered && !wasRight ? 'ewm-micro-shake' : ''
        }`}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF3F1] dark:bg-[#1C332D] text-[#225851] dark:text-[#86CEC2] text-[11px] font-bold">
              {challenge.promptTitlePt}
            </span>

            <span className="text-[11px] text-[#6B655C] dark:text-[#9CA49E]">
              {challenge.card.category} · {challenge.card.subtopic}
            </span>
          </div>

          {challenge.kind === 'listening' && challenge.spokenText ? (
            <div className="rounded-2xl border border-[#C6DBD7] dark:border-[#2B433D] bg-[#F3FAF8] dark:bg-[#182723] p-4 flex flex-col items-center text-center space-y-2.5">
              <button
                type="button"
                aria-pressed={audioBtnState !== 'idle'}
                aria-busy={audioBtnState === 'loading'}
                onClick={() => {
                  void triggerTap();
                  void toggleSpeakEnglishText(challenge.spokenText!, challenge.accent, {
                    role: 'term',
                    sourceId: `survival-audio-${challenge.challengeId}`,
                  });
                }}
                className={`min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] text-white text-sm font-bold cursor-pointer ${
                  audioBtnState === 'loading'
                    ? 'ewm-audio-loading'
                    : audioBtnState === 'playing'
                    ? 'ewm-audio-playing'
                    : ''
                }`}
              >
                <AudioStatusIcon
                  state={audioBtnState}
                  idleClassName="w-4.5 h-4.5"
                  activeClassName="w-4.5 h-4"
                />
                <span>
                  🔊 Ouvir Áudio ({challenge.accent === 'uk' ? '🇬🇧 UK' : '🇺🇸 US'})
                </span>
              </button>
              <p className="text-xs text-[#524E46] dark:text-[#B5C0B9]">
                {challenge.promptPrimary}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#1C1B18] dark:text-[#F4F7F6] leading-snug">
                {challenge.kind === 'cloze'
                  ? `“${challenge.promptPrimary}”`
                  : `“${challenge.promptPrimary}”`}
              </h3>
              {challenge.promptSecondaryPt && (
                <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#B5C0B9]">
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
                  <CheckCircle2 className="w-4.5 h-4.5 text-[#10B981] shrink-0" />
                )}
                {isAnswered && opt.id === selectedOptionId && !opt.isCorrect && (
                  <XCircle className="w-4.5 h-4.5 text-[#B5443C] shrink-0" />
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
                ? 'border-[#38E5A5]/60 bg-[#ECFDF5] dark:bg-[#163026]'
                : 'border-[#E5C6C3] dark:border-[#4A2826] bg-[#FDF6F5] dark:bg-[#2A1B1A]'
            }`}
          >
            <p className="text-xs sm:text-[13px] font-semibold text-[#1C1B18] dark:text-[#F4F7F6] flex-1 min-w-[200px]">
              {wasRight
                ? `🔥 Sequência em ${currentStreak}! ${challenge.explanationLinePt}`
                : `💔 -1 vida · ${challenge.explanationLinePt}`}
            </p>

            <button
              type="button"
              onClick={handleContinue}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white text-xs sm:text-sm font-semibold cursor-pointer ml-auto"
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
