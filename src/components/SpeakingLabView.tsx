import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  WifiOff,
  AlertCircle,
  Loader2,
  FolderOpen,
  PenLine,
  BookOpenCheck,
} from 'lucide-react';
import { VALID_FOLDERS, VALID_SUBTOPICS } from '../data/seedData';
import type {
  EnglishAccent,
  Flashcard,
  SubtopicKey,
  TopicFolder,
} from '../types/flashcard';
import { getCardPhonetics } from '../utils/phonetics';
import { useAcousticRecorder } from '../hooks/useAcousticRecorder';
import {
  getAudioButtonVisualState,
  getSelectedVoiceLocale,
  stopCurrentAudio,
  subscribeAudioPlayback,
  switchVoiceLocale,
  toggleSpeakEnglishText,
  type ActiveAudioPlayback,
} from '../services/platform/speechService';
import { triggerError, triggerSuccess, triggerTap } from '../services/platform/hapticsService';
import { AudioStatusIcon, AudioWaveIcon } from './CardAudioControls';
import type {
  PronunciationEvaluationResult,
  WordBreakdownItem,
} from '../utils/pronunciationEngine';

export type SpeakingPracticeMode = 'review' | 'catalog' | 'free';
export type SpeakingCardContentTarget = 'sentence' | 'term';
export type NativeCadenceChoice = '1.0x' | '0.8x';

interface SpeakingLabViewProps {
  allCards: Flashcard[];
  studyCards?: Flashcard[];
  onGoToStudy: () => void;
  onPronunciationEvaluated?: (
    result: PronunciationEvaluationResult,
    targetText: string
  ) => { awardedXp: number; alreadyRewardedToday: boolean; dailyCappedOut?: boolean } | void;
}

const FREE_PRACTICE_SUGGESTIONS = [
  'She thinks it worked well today.',
  "Let's call it a day and wrap this up.",
  "To be honest, it's worth a shot.",
];

const STUDIO_SYMMETRIC_WAVE_ENVELOPE = [
  0.09, 0.13, 0.19, 0.36, 0.56, 0.41, 0.24, 0.46, 0.66, 0.38, 0.22, 0.52, 0.82,
  0.96, 1.0, 0.94, 0.78, 0.5, 0.24, 0.4, 0.66, 0.48, 0.25, 0.42, 0.56, 0.34,
  0.19, 0.13, 0.09,
] as const;

export const SpeakingLabView = memo(function SpeakingLabView({
  allCards,
  studyCards,
  onGoToStudy,
  onPronunciationEvaluated,
}: SpeakingLabViewProps) {
  const [practiceMode, setPracticeMode] = useState<SpeakingPracticeMode>('review');
  const [contentTarget, setContentTarget] = useState<SpeakingCardContentTarget>('sentence');
  const [selectedFolder, setSelectedFolder] = useState<'all' | TopicFolder>('all');
  const [selectedSubtopic, setSelectedSubtopic] = useState<'all' | SubtopicKey>('all');
  const [cardCursor, setCardCursor] = useState<number>(0);

  const [freeInputDraft, setFreeInputDraft] = useState<string>(
    'She thinks it worked well today.'
  );
  const [freeTargetText, setFreeTargetText] = useState<string>(
    'She thinks it worked well today.'
  );

  const [accentUi, setAccentUi] = useState<EnglishAccent>(() =>
    getSelectedVoiceLocale()
  );
  const [cadence, setCadence] = useState<NativeCadenceChoice>('1.0x');

  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);
  const [xpAwardState, setXpAwardState] = useState<{
    awardedXp: number;
    alreadyRewardedToday: boolean;
  } | null>(null);
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(null);

  useEffect(() => {
    const unsub = subscribeAudioPlayback(setActiveAudio);
    return () => {
      unsub();
      stopCurrentAudio();
    };
  }, []);

  // Build prioritized card pool for 'review' and 'catalog' modes
  const activePool = useMemo<Flashcard[]>(() => {
    const baseCards = allCards.length > 0 ? allCards : studyCards || [];
    if (practiceMode === 'review') {
      const reviewPriority = baseCards.filter((c) => c.status === 'review');
      const unseenPriority = baseCards.filter((c) => c.status === 'unseen');
      const nonMastered = [...reviewPriority, ...unseenPriority];
      if (nonMastered.length > 0) return nonMastered;
      return studyCards && studyCards.length > 0 ? studyCards : baseCards;
    }

    if (practiceMode === 'catalog') {
      return baseCards.filter((card) => {
        const folderOk =
          selectedFolder === 'all' || card.category === selectedFolder;
        const subtopicOk =
          selectedSubtopic === 'all' || card.subtopic === selectedSubtopic;
        return folderOk && subtopicOk;
      });
    }

    return baseCards;
  }, [allCards, studyCards, practiceMode, selectedFolder, selectedSubtopic]);

  const safeCursor =
    activePool.length > 0 ? Math.min(cardCursor, activePool.length - 1) : 0;
  const currentCard = practiceMode !== 'free' ? activePool[safeCursor] || null : null;

  const phonetics = useMemo(
    () => (currentCard ? getCardPhonetics(currentCard) : null),
    [currentCard]
  );

  const targetText = useMemo(() => {
    if (practiceMode === 'free') {
      return freeTargetText.trim() || 'Keep practicing every day.';
    }
    if (!currentCard) return '';
    if (contentTarget === 'sentence' && currentCard.exampleEn?.trim()) {
      return currentCard.exampleEn.trim();
    }
    return currentCard.term.trim();
  }, [practiceMode, freeTargetText, currentCard, contentTarget]);

  const contextualTranslationPt = useMemo(() => {
    if (practiceMode === 'free') {
      return 'Treino livre sob demanda · Toque em qualquer palavra após gravar para ouvir o som isolado';
    }
    if (!currentCard) return '';
    if (contentTarget === 'sentence' && currentCard.examplePt?.trim()) {
      return currentCard.examplePt.trim();
    }
    return currentCard.colloquial?.[0] || currentCard.literal || '';
  }, [practiceMode, currentCard, contentTarget]);

  const bcp47Accent = accentUi === 'uk' ? 'en-GB' : 'en-US';
  const playbackRateOverride = cadence === '0.8x' ? 0.8 : 1.0;

  const handleEvaluated = useCallback(
    (result: PronunciationEvaluationResult, evaluatedText: string) => {
      if (result.audioQualityStatus === 'CLEAR') {
        const firstNeedsAttention = result.wordBreakdown.findIndex(
          (w) => w.status !== 'EXACT'
        );
        setSelectedWordIdx(firstNeedsAttention >= 0 ? firstNeedsAttention : 0);

        if (result.verdict === 'NEEDS_PRACTICE') {
          void triggerError();
        } else {
          void triggerSuccess();
        }
      } else {
        setSelectedWordIdx(null);
        void triggerError();
      }

      const outcome = onPronunciationEvaluated?.(result, evaluatedText);
      if (outcome) {
        setXpAwardState({
          awardedXp: outcome.awardedXp,
          alreadyRewardedToday: outcome.alreadyRewardedToday,
        });
      } else {
        setXpAwardState(null);
      }
    },
    [onPronunciationEvaluated]
  );

  const {
    status,
    voiceLevel,
    waveformBars,
    elapsedMs,
    maxDurationMs,
    recordedUrl,
    isPlayingOwnAudio,
    evaluation,
    micError,
    offlineSelfCheckNotice,
    networkError,
    isOnline,
    startRecording,
    stopRecording,
    togglePlayOwnRecording,
    stopOwnPlayback,
    resetEvaluationAndRecording,
  } = useAcousticRecorder({
    targetText,
    accent: bcp47Accent,
    mode: 'lab-detailed',
    maxDurationMs: 12000,
    onEvaluated: handleEvaluated,
  });

  const handleSwitchAccent = useCallback((next: EnglishAccent) => {
    void triggerTap();
    setAccentUi(next);
    switchVoiceLocale(next);
  }, []);

  const targetPedagogicalRole: 'term' | 'sentence' =
    practiceMode === 'free' || contentTarget === 'sentence' ? 'sentence' : 'term';

  const handleSpeakNative = useCallback(
    (
      textToSpeak: string,
      opts?: { sourceId?: string; role?: 'term' | 'sentence' }
    ) => {
      if (!textToSpeak.trim()) return;
      void triggerTap();
      stopOwnPlayback();
      void toggleSpeakEnglishText(textToSpeak, accentUi, {
        speed: 'normal',
        rateOverride: playbackRateOverride,
        role: opts?.role ?? targetPedagogicalRole,
        sourceId: opts?.sourceId,
      });
    },
    [accentUi, playbackRateOverride, stopOwnPlayback, targetPedagogicalRole]
  );

  const handleNextPhrase = useCallback(() => {
    void triggerTap();
    stopCurrentAudio();
    resetEvaluationAndRecording();
    setSelectedWordIdx(null);
    setXpAwardState(null);

    if (practiceMode === 'free') {
      const currentIdx = FREE_PRACTICE_SUGGESTIONS.indexOf(freeTargetText);
      const nextSuggestion =
        FREE_PRACTICE_SUGGESTIONS[
          (currentIdx + 1) % FREE_PRACTICE_SUGGESTIONS.length
        ];
      setFreeInputDraft(nextSuggestion);
      setFreeTargetText(nextSuggestion);
      return;
    }

    if (activePool.length > 0) {
      setCardCursor((prev) => (prev + 1 < activePool.length ? prev + 1 : 0));
    }
  }, [activePool.length, freeTargetText, practiceMode, resetEvaluationAndRecording]);

  const handlePrevPhrase = useCallback(() => {
    void triggerTap();
    stopCurrentAudio();
    resetEvaluationAndRecording();
    setSelectedWordIdx(null);
    setXpAwardState(null);

    if (activePool.length > 0) {
      setCardCursor((prev) =>
        prev - 1 >= 0 ? prev - 1 : activePool.length - 1
      );
    }
  }, [activePool.length, resetEvaluationAndRecording]);

  const handleApplyFreePhrase = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const cleaned = freeInputDraft.replace(/\s+/g, ' ').trim();
      if (!cleaned) return;
      void triggerTap();
      setSelectedWordIdx(null);
      setXpAwardState(null);
      setFreeTargetText(cleaned);
    },
    [freeInputDraft]
  );

  const isRecording = status === 'recording';
  const isEvaluating = status === 'evaluating';
  const isRequestingMic = status === 'requesting_mic';

  const nativeMainState = getAudioButtonVisualState(activeAudio, {
    text: targetText,
    accent: accentUi,
    sourceId: 'speaking-model-main',
  });
  const nativeCompareState = getAudioButtonVisualState(activeAudio, {
    text: targetText,
    accent: accentUi,
    sourceId: 'speaking-compare-native',
  });
  const stateMotionClass = (st: 'idle' | 'loading' | 'playing') =>
    st === 'loading' ? 'ewm-audio-loading' : st === 'playing' ? 'ewm-audio-playing' : '';

  const activeWordItem: WordBreakdownItem | null =
    evaluation &&
    evaluation.audioQualityStatus === 'CLEAR' &&
    evaluation.wordBreakdown.length > 0
      ? evaluation.wordBreakdown[
          selectedWordIdx !== null &&
          selectedWordIdx >= 0 &&
          selectedWordIdx < evaluation.wordBreakdown.length
            ? selectedWordIdx
            : 0
        ] || null
      : null;

  const verdictBanner =
    evaluation && evaluation.audioQualityStatus === 'CLEAR'
      ? evaluation.verdict === 'NATIVE_LIKE'
        ? {
            label: '🟢 Pronúncia Natural & Fluida',
            toneClasses:
              'border-[#A8D5BA] dark:border-[#2F5E46] bg-[#EDF8F2] dark:bg-[#192D23] text-[#1D5B3B] dark:text-[#7FE0AA]',
          }
        : evaluation.verdict === 'UNDERSTANDABLE_POLISH'
        ? {
            label: '🟡 Compreensível · Lapidar Detalhes',
            toneClasses:
              'border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] text-[#9A5B13] dark:text-[#E6B472]',
          }
        : {
            label: '🔴 Precisa Praticar Articulação',
            toneClasses:
              'ewm-micro-shake border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] text-[#A63A32] dark:text-[#F0948D]',
          }
      : null;

  return (
    <section
      aria-label="Speaking Lab — Laboratório Acústico de Pronúncia"
      data-testid="speaking-lab-view"
      className="ewm-pillar-enter space-y-4"
    >
      {/* 1. SESSION HEADER & PRACTICE SELECTION */}
      <div className="rounded-3xl border border-[#10D990]/30 dark:border-[#38E5A5]/22 bg-white dark:bg-[#131B23] p-4 sm:p-5 shadow-[0_4px_18px_rgba(16,217,144,0.12)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.42),0_0_18px_rgba(56,229,165,0.06)] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Smart Practice Filter Pills */}
          <div
            role="tablist"
            aria-label="Modo de prática no Speaking Lab"
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={practiceMode === 'review'}
              data-testid="speaking-mode-review"
              onClick={() => {
                void triggerTap();
                setPracticeMode('review');
                setCardCursor(0);
                setSelectedWordIdx(null);
                setXpAwardState(null);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                practiceMode === 'review'
                  ? 'border-[#00C982] bg-[#00A86E] text-white dark:border-[#38E5A5]/60 dark:bg-[#38E5A5]/18 dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.24)]'
                  : 'border-transparent bg-[#EFF6F3] hover:bg-[#E2F0EA] dark:bg-[#1C2631] dark:hover:bg-[#24303E] text-[#334155] dark:text-[#B8C7D4]'
              }`}
            >
              <BookOpenCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Para Revisar / Em Estudo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={practiceMode === 'catalog'}
              data-testid="speaking-mode-catalog"
              onClick={() => {
                void triggerTap();
                setPracticeMode('catalog');
                setCardCursor(0);
                setSelectedWordIdx(null);
                setXpAwardState(null);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                practiceMode === 'catalog'
                  ? 'border-[#00C982] bg-[#00A86E] text-white dark:border-[#38E5A5]/60 dark:bg-[#38E5A5]/18 dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.24)]'
                  : 'border-transparent bg-[#EFF6F3] hover:bg-[#E2F0EA] dark:bg-[#1C2631] dark:hover:bg-[#24303E] text-[#334155] dark:text-[#B8C7D4]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Por Pasta / Subtópico</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={practiceMode === 'free'}
              data-testid="speaking-mode-free"
              onClick={() => {
                void triggerTap();
                setPracticeMode('free');
                setSelectedWordIdx(null);
                setXpAwardState(null);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                practiceMode === 'free'
                  ? 'border-[#00C982] bg-[#00A86E] text-white dark:border-[#38E5A5]/60 dark:bg-[#38E5A5]/18 dark:text-[#38E5A5] shadow-[0_2px_12px_rgba(16,217,144,0.24)]'
                  : 'border-transparent bg-[#EFF6F3] hover:bg-[#E2F0EA] dark:bg-[#1C2631] dark:hover:bg-[#24303E] text-[#334155] dark:text-[#B8C7D4]'
              }`}
            >
              <PenLine className="w-3.5 h-3.5 shrink-0" />
              <span>Treino Livre</span>
            </button>
          </div>

          {/* Reference Accent (US vs UK) & Native Speed (1.0x vs 0.8x) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-[#EDF5F2] dark:bg-[#1B2530] border border-[#10D990]/25 dark:border-[#38E5A5]/20">
              <button
                type="button"
                data-testid="speaking-accent-us"
                onClick={() => handleSwitchAccent('us')}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  accentUi === 'us'
                    ? 'bg-[#00A86E] dark:bg-[#38E5A5] text-white dark:text-[#081510]'
                    : 'text-[#475569] dark:text-[#9FB0BF]'
                }`}
              >
                🇺🇸 US
              </button>
              <button
                type="button"
                data-testid="speaking-accent-uk"
                onClick={() => handleSwitchAccent('uk')}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  accentUi === 'uk'
                    ? 'bg-[#1D4ED8] dark:bg-[#38BDF8] text-white dark:text-[#081520]'
                    : 'text-[#475569] dark:text-[#9FB0BF]'
                }`}
              >
                🇬🇧 UK
              </button>
            </div>

            <div className="inline-flex p-0.5 rounded-xl bg-[#EDF5F2] dark:bg-[#1B2530] border border-[#10D990]/25 dark:border-[#38E5A5]/20">
              <button
                type="button"
                data-testid="speaking-speed-normal"
                onClick={() => {
                  void triggerTap();
                  setCadence('1.0x');
                }}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                  cadence === '1.0x'
                    ? 'bg-white dark:bg-[#111820] text-[#0F172A] dark:text-[#F1F7F5] shadow-2xs'
                    : 'text-[#475569] dark:text-[#9FB0BF]'
                }`}
              >
                1.0x Natural
              </button>
              <button
                type="button"
                data-testid="speaking-speed-cadenced"
                onClick={() => {
                  void triggerTap();
                  setCadence('0.8x');
                }}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                  cadence === '0.8x'
                    ? 'bg-[#FEF3C7] dark:bg-[#332714] text-[#92400E] dark:text-[#FCD34D] shadow-2xs'
                    : 'text-[#475569] dark:text-[#9FB0BF]'
                }`}
              >
                0.8x Cadenciado
              </button>
            </div>
          </div>
        </div>

        {/* Sub-controls per mode */}
        {practiceMode === 'catalog' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#ECE8DF] dark:border-[#2B302B]">
            <select
              aria-label="Filtrar por Pasta Oficial EWM"
              value={selectedFolder}
              onChange={(e) => {
                setSelectedFolder(e.target.value as 'all' | TopicFolder);
                setCardCursor(0);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#262B26] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
            >
              <option value="all">Todas as Pastas EWM</option>
              {VALID_FOLDERS.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por Subtópico EWM"
              value={selectedSubtopic}
              onChange={(e) => {
                setSelectedSubtopic(e.target.value as 'all' | SubtopicKey);
                setCardCursor(0);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#262B26] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
            >
              <option value="all">Todos os Subtópicos</option>
              {VALID_SUBTOPICS.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {practiceMode !== 'free' && currentCard && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="inline-flex p-0.5 rounded-xl bg-[#F3F1EC] dark:bg-[#272C27] border border-[#E4E0D8] dark:border-[#343A34]">
              <button
                type="button"
                onClick={() => {
                  void triggerTap();
                  setContentTarget('sentence');
                  setSelectedWordIdx(null);
                  setXpAwardState(null);
                }}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  contentTarget === 'sentence'
                    ? 'bg-white dark:bg-[#1A1D1A] text-[#1C1B18] dark:text-[#F3F1EC] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#A39E93]'
                }`}
              >
                Praticar Frase Completa
              </button>
              <button
                type="button"
                onClick={() => {
                  void triggerTap();
                  setContentTarget('term');
                  setSelectedWordIdx(null);
                  setXpAwardState(null);
                }}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  contentTarget === 'term'
                    ? 'bg-white dark:bg-[#1A1D1A] text-[#1C1B18] dark:text-[#F3F1EC] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#A39E93]'
                }`}
              >
                Praticar Expressão ({currentCard.term})
              </button>
            </div>

            <span className="text-xs font-mono-num text-[#6B655C] dark:text-[#A39E93]">
              Item {safeCursor + 1} de {activePool.length} · {currentCard.category}
            </span>
          </div>
        )}

        {practiceMode === 'free' && (
          <form
            onSubmit={handleApplyFreePhrase}
            className="pt-2 border-t border-[#ECE8DF] dark:border-[#2B302B] space-y-2"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                data-testid="speaking-free-input"
                value={freeInputDraft}
                maxLength={220}
                onChange={(e) => setFreeInputDraft(e.target.value)}
                placeholder="Digite ou cole qualquer frase em inglês para praticar..."
                className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDD8CE] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#161916] text-sm text-[#1C1B18] dark:text-[#F3F1EC] focus:outline-none focus:border-[#28665E] dark:focus:border-[#2EA98C]"
              />
              <button
                type="submit"
                data-testid="speaking-free-apply-btn"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2EA98C] dark:hover:bg-[#27947A] text-white dark:text-[#0E1715] text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Definir Frase
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#7D776C] dark:text-[#989388]">
                Exemplos rápidos:
              </span>
              {FREE_PRACTICE_SUGGESTIONS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    void triggerTap();
                    setFreeInputDraft(sample);
                    setFreeTargetText(sample);
                    setSelectedWordIdx(null);
                    setXpAwardState(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#F3F1EC] hover:bg-[#E7E3DA] dark:bg-[#262B26] dark:hover:bg-[#303630] text-[11px] text-[#4A463F] dark:text-[#C5C0B5] cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </form>
        )}
      </div>

      {/* Empty Filter State */}
      {practiceMode !== 'free' && !currentCard ? (
        <div className="rounded-3xl border border-[#E4E0D8] dark:border-[#2B302B] bg-white dark:bg-[#1E221E] p-8 text-center space-y-3">
          <p className="text-sm font-medium text-[#5C574E] dark:text-[#C5C0B5]">
            Nenhum card encontrado para esta combinação de Pasta e Subtópico.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedFolder('all');
                setSelectedSubtopic('all');
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#28665E] text-white text-xs font-semibold cursor-pointer"
            >
              Mostrar todas as pastas
            </button>
            <button
              type="button"
              onClick={onGoToStudy}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-[#DDD8CE] dark:border-[#343A34] text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] cursor-pointer"
            >
              Voltar ao Estudo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. CENTRAL ACOUSTIC STAGE (STUDIO WAVEFORM + DOCKED HALO MIC + INLINE CALIBRATED PHRASE) */}
          <div className="rounded-3xl border border-[#10D990]/30 dark:border-[#38E5A5]/24 bg-white dark:bg-[#131B23] p-5 sm:p-8 shadow-[0_6px_22px_rgba(16,217,144,0.12)] dark:shadow-[0_14px_38px_rgba(0,0,0,0.48),0_0_22px_rgba(56,229,165,0.08)] space-y-6">
            {/* Offline Self-Check Notice */}
            {(!isOnline || offlineSelfCheckNotice) && (
              <div className="rounded-2xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] px-4 py-3 flex items-start gap-3 text-xs sm:text-sm text-[#8A5110] dark:text-[#E6B472]">
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  {offlineSelfCheckNotice ||
                    'Sem conexão com a internet: a análise fonética profunda por IA requer rede ativa, mas você pode gravar sua voz e usar "▶️ Ouvir Minha Gravação" lado a lado com o áudio nativo local!'}
                </p>
              </div>
            )}

            {/* Top Studio Prompt + Native Model Trigger */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 max-w-2xl mx-auto">
              <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#475569] dark:text-[#A8BAC8]">
                Repita a frase em voz alta:
              </p>

              <button
                type="button"
                data-testid="speaking-listen-model-btn"
                aria-pressed={nativeMainState !== 'idle'}
                aria-busy={nativeMainState === 'loading'}
                onClick={() =>
                  handleSpeakNative(targetText, {
                    sourceId: 'speaking-model-main',
                    role: targetPedagogicalRole,
                  })
                }
                className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${stateMotionClass(
                  nativeMainState
                )} ${
                  nativeMainState !== 'idle'
                    ? 'bg-[#00A86E] dark:bg-[#38E5A5] text-white dark:text-[#071510] border-[#00C982] dark:border-[#38E5A5] shadow-[0_0_14px_rgba(56,229,165,0.35)]'
                    : 'bg-[#EFF8F4] hover:bg-[#E1F3EC] dark:bg-[#1A2530] dark:hover:bg-[#21303E] border-[#10D990]/35 dark:border-[#38E5A5]/28 text-[#0F5C42] dark:text-[#6EE7B7]'
                }`}
              >
                <AudioStatusIcon
                  state={nativeMainState}
                  idleClassName="w-4 h-4 shrink-0"
                  activeClassName="w-4 h-3.5"
                />
                <span>
                  {nativeMainState === 'loading'
                    ? 'Carregando Modelo Nativo...'
                    : nativeMainState === 'playing'
                    ? 'Reproduzindo Modelo Nativo...'
                    : `Ouvir Modelo Nativo (${accentUi.toUpperCase()} · ${cadence})`}
                </span>
              </button>
            </div>

            {/* Acoustic Oscillogram Box + Docked Central Halo Microphone */}
            <div className="max-w-xl mx-auto flex flex-col items-center">
              <div
                aria-hidden="true"
                data-testid="speaking-acoustic-stage-box"
                className="w-full rounded-3xl border border-[#00C982]/35 dark:border-[#38E5A5]/28 bg-[#ECF9F3] dark:bg-[#17202B] px-4 sm:px-8 pt-8 pb-14 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_20px_rgba(16,217,144,0.12)] dark:shadow-[inset_0_1px_0_rgba(56,229,165,0.10),0_10px_28px_rgba(0,0,0,0.45)] flex items-center justify-center"
              >
                {/* Symmetrical Center-Axis Vertical Waveform Bars */}
                <div className="h-24 sm:h-28 w-full max-w-md flex items-center justify-center gap-1 sm:gap-1.5">
                  {STUDIO_SYMMETRIC_WAVE_ENVELOPE.map((envWeight, idx) => {
                    const liveSample =
                      waveformBars[idx % Math.max(1, waveformBars.length)] ?? 0.2;
                    const activeScale = isRecording
                      ? Math.min(
                          100,
                          Math.max(
                            12,
                            Math.round(
                              (envWeight * 0.48 +
                                liveSample * 0.65 +
                                Math.min(0.35, voiceLevel) * 0.35) *
                                100
                            )
                          )
                        )
                      : Math.max(8, Math.round(envWeight * 78));

                    return (
                      <span
                        key={idx}
                        style={{
                          height: `${activeScale}%`,
                          opacity: isRecording
                            ? 0.72 + Math.min(0.28, voiceLevel)
                            : 0.62 + envWeight * 0.34,
                        }}
                        className={`w-1 sm:w-1.5 rounded-full transition-[height,opacity] duration-75 bg-gradient-to-b from-[#00C982] via-[#10D990] to-[#06B6D4] dark:from-[#6EE7B7] dark:via-[#38E5A5] dark:to-[#22D3EE] ${
                          isRecording
                            ? 'shadow-[0_0_10px_rgba(56,229,165,0.55)]'
                            : 'dark:shadow-[0_0_6px_rgba(56,229,165,0.28)]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Central Circular Microphone Button Docked on Bottom Edge of Stage */}
              <button
                type="button"
                disabled={isEvaluating || isRequestingMic}
                data-testid="speaking-protagonist-mic-btn"
                aria-label={
                  isRecording
                    ? 'Parar gravação e avaliar pronúncia'
                    : 'Iniciar gravação de pronúncia'
                }
                onClick={() => {
                  void triggerTap();
                  if (isRecording) {
                    stopRecording();
                  } else {
                    setXpAwardState(null);
                    void startRecording();
                  }
                }}
                className={`-mt-10 sm:-mt-12 relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all cursor-pointer select-none border-[3.5px] ${
                  isRecording
                    ? 'ewm-breathing-ring border-[#FB7185] bg-[#881337] hover:bg-[#9F1239] text-white scale-105 shadow-[0_0_28px_rgba(244,63,94,0.55)]'
                    : isEvaluating || isRequestingMic
                    ? 'border-[#94A3B8]/50 bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] cursor-wait'
                    : 'ewm-mic-halo ewm-mic-halo-pulse border-[#00C982] dark:border-[#38E5A5] bg-[#0F241F] hover:bg-[#133029] dark:bg-[#15252F] dark:hover:bg-[#1B303C] text-white'
                }`}
              >
                {isEvaluating || isRequestingMic ? (
                  <Loader2 className="w-8 h-8 animate-spin text-[#00C982] dark:text-[#38E5A5]" />
                ) : isRecording ? (
                  <Square className="w-7 h-7 fill-current" />
                ) : (
                  <Mic className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
                )}
              </button>

              <p className="mt-3 text-xs font-medium text-[#475569] dark:text-[#9FB0BF] text-center">
                {isRequestingMic
                  ? 'Solicitando acesso ao microfone...'
                  : isRecording
                  ? `Gravando sua voz (${Math.min(
                      12,
                      Math.ceil((maxDurationMs - elapsedMs) / 1000)
                    )}s restantes) · Toque para concluir`
                  : isEvaluating
                  ? 'Analisando fonemas, vogais e ritmo acústico...'
                  : evaluation && evaluation.audioQualityStatus === 'CLEAR'
                  ? 'Feedback em tempo real · Toque em qualquer palavra iluminada para ouvir'
                  : 'Toque no microfone e leia a frase com naturalidade'}
              </p>
            </div>

            {/* Target Sentence with Inline Illuminated Word Calibration Pills */}
            <div className="text-center max-w-2xl mx-auto space-y-2.5 pt-1">
              <h2
                style={{ textWrap: 'balance' }}
                data-testid="speaking-stage-target"
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0F172A] dark:text-[#F4F8F6] leading-snug"
              >
                {evaluation &&
                evaluation.audioQualityStatus === 'CLEAR' &&
                evaluation.wordBreakdown.length > 0
                  ? evaluation.wordBreakdown.map((item, idx) => {
                      const isSelected = (selectedWordIdx ?? 0) === idx;
                      const inlinePillClass =
                        item.status === 'EXACT'
                          ? 'bg-[#10D990]/18 dark:bg-[#38E5A5]/20 border-[#00C982]/50 dark:border-[#38E5A5]/55 text-[#065F46] dark:text-[#6EE7B7] shadow-[0_0_12px_rgba(56,229,165,0.20)]'
                          : item.status === 'CLOSE_NEEDS_POLISH'
                          ? 'bg-[#F59E0B]/18 dark:bg-[#FBBF24]/20 border-[#D97706]/50 dark:border-[#FBBF24]/55 text-[#92400E] dark:text-[#FDE68A] shadow-[0_0_12px_rgba(251,191,36,0.20)]'
                          : 'bg-[#F43F5E]/18 dark:bg-[#FB7185]/22 border-[#E11D48]/50 dark:border-[#FB7185]/55 text-[#9F1239] dark:text-[#FDA4AF] shadow-[0_0_12px_rgba(251,113,133,0.22)]';

                      return (
                        <React.Fragment key={`inline-word-${idx}`}>
                          {idx > 0 ? ' ' : ''}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWordIdx(idx);
                              handleSpeakNative(item.word, {
                                sourceId: `speaking-inline-word-${idx}`,
                                role: 'term',
                              });
                            }}
                            className={`inline-flex items-center px-2 py-0.5 my-0.5 rounded-xl border font-bold transition-transform cursor-pointer ${inlinePillClass} ${
                              isSelected
                                ? 'ring-2 ring-[#00C982] dark:ring-[#38E5A5] scale-[1.03]'
                                : 'hover:scale-[1.02]'
                            }`}
                          >
                            {item.word}
                          </button>
                        </React.Fragment>
                      );
                    })
                  : targetText}
              </h2>

              {evaluation &&
                evaluation.audioQualityStatus === 'CLEAR' &&
                evaluation.wordBreakdown.length > 0 && (
                  <p className="text-[11px] sm:text-xs font-semibold tracking-wide">
                    <span className="text-[#059669] dark:text-[#38E5A5]">
                      Calibração fonética
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]"> · </span>
                    <span className="text-[#D97706] dark:text-[#FBBF24]">
                      lapidar vogal/ritmo
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]"> · </span>
                    <span className="text-[#E11D48] dark:text-[#FB7185]">
                      revisar som
                    </span>
                  </p>
                )}

              {contextualTranslationPt && (
                <p className="text-xs sm:text-sm text-[#475569] dark:text-[#9FB0BF] leading-relaxed">
                  {contextualTranslationPt}
                </p>
              )}

              {practiceMode !== 'free' &&
                contentTarget === 'term' &&
                phonetics && (
                  <p className="text-xs font-mono-num text-[#047857] dark:text-[#38E5A5]">
                    {accentUi === 'uk'
                      ? `UK ${phonetics.uk}`
                      : `US ${phonetics.us}`}
                  </p>
                )}
            </div>

            {/* Friendly Microphone Permission Instructions */}
            {micError && (
              <div
                data-testid="speaking-mic-error"
                className="max-w-xl mx-auto rounded-2xl border border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] p-4 flex items-start gap-3 text-xs sm:text-sm text-[#A63A32] dark:text-[#F0948D]"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">{micError.titlePtBr}</p>
                  <p className="leading-relaxed opacity-90">
                    {micError.instructionsPtBr}
                  </p>
                </div>
              </div>
            )}

            {networkError && (
              <div className="max-w-xl mx-auto rounded-2xl border border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] p-3.5 text-center text-xs sm:text-sm text-[#A63A32] dark:text-[#F0948D]">
                {networkError}
              </div>
            )}

            {/* Direct Comparison & Navigation Bar (Always accessible after recording or for browsing) */}
            <div className="pt-3 border-t border-[#ECE8DF] dark:border-[#2B302B] flex flex-wrap items-center justify-center gap-2">
              {recordedUrl && (
                <>
                  <button
                    type="button"
                    data-testid="speaking-play-own-btn"
                    aria-pressed={isPlayingOwnAudio}
                    onClick={() => {
                      void triggerTap();
                      togglePlayOwnRecording();
                    }}
                    className={`min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      isPlayingOwnAudio
                        ? 'ewm-audio-playing bg-[#1C1B18] text-white border-[#1C1B18] dark:bg-[#EBE7DE] dark:text-[#1C1B18]'
                        : 'bg-[#FAF8F4] hover:bg-[#F0EDE6] dark:bg-[#252A26] dark:hover:bg-[#2F3530] border-[#DFDAD0] dark:border-[#343A34] text-[#1C1B18] dark:text-[#EBE7DE]'
                    }`}
                  >
                    {isPlayingOwnAudio ? (
                      <AudioWaveIcon className="w-3.5 h-3" />
                    ) : (
                      <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
                    )}
                    <span>
                      {isPlayingOwnAudio
                        ? 'Ouvindo Minha Gravação...'
                        : 'Ouvir Minha Gravação'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="speaking-compare-native-btn"
                    aria-pressed={nativeCompareState !== 'idle'}
                    aria-busy={nativeCompareState === 'loading'}
                    onClick={() =>
                      handleSpeakNative(targetText, {
                        sourceId: 'speaking-compare-native',
                        role: targetPedagogicalRole,
                      })
                    }
                    className={`min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${stateMotionClass(
                      nativeCompareState
                    )} ${
                      nativeCompareState !== 'idle'
                        ? 'bg-[#28665E] border-[#28665E] text-white'
                        : 'border-[#C2DAD5] dark:border-[#2F4B46] bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2]'
                    }`}
                  >
                    <AudioStatusIcon
                      state={nativeCompareState}
                      idleClassName="w-3.5 h-3.5 shrink-0"
                      activeClassName="w-3.5 h-3"
                    />
                    <span>
                      {nativeCompareState === 'loading'
                        ? 'Carregando Nativo...'
                        : nativeCompareState === 'playing'
                        ? 'Ouvindo Nativo...'
                        : 'Comparar com Nativo'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="speaking-rerecord-btn"
                    onClick={() => {
                      void triggerTap();
                      setXpAwardState(null);
                      void startRecording();
                    }}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DFDAD0] dark:border-[#343A34] bg-white hover:bg-[#F5F3EE] dark:bg-[#212521] dark:hover:bg-[#2A2F2A] text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] transition-colors cursor-pointer"
                  >
                    <span>🔄 Gravar Novamente</span>
                  </button>
                </>
              )}

              {practiceMode !== 'free' && activePool.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrevPhrase}
                  aria-label="Frase anterior"
                  className="min-h-[42px] inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#DFDAD0] dark:border-[#343A34] bg-white hover:bg-[#F5F3EE] dark:bg-[#212521] text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              <button
                type="button"
                data-testid="speaking-next-phrase-btn"
                onClick={handleNextPhrase}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Próxima Frase</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. INTERACTIVE WORD-BY-WORD DIAGNOSTIC PANEL */}
          {evaluation && evaluation.audioQualityStatus !== 'CLEAR' && (
            <div
              data-testid="speaking-non-clear-guard"
              className="ewm-micro-shake rounded-3xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#9A5B13] dark:text-[#E6B472]"
            >
              <div className="space-y-0.5">
                <p className="font-bold">Áudio sem fala clara detectada</p>
                <p className="text-xs sm:text-sm opacity-90">
                  {evaluation.coachSummaryPtBr}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void startRecording()}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#9A5B13] text-white text-xs font-bold cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Gravar Novamente</span>
              </button>
            </div>
          )}

          {evaluation &&
            evaluation.audioQualityStatus === 'CLEAR' &&
            verdictBanner && (
              <div
                data-testid="speaking-diagnostic-panel"
                className="rounded-3xl border border-[#E4E0D8] dark:border-[#2B302B] bg-white dark:bg-[#1E221E] p-5 sm:p-6 shadow-xs space-y-4 ewm-pillar-enter"
              >
                {/* Verdict Card + Score + XP Float */}
                <div
                  className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${verdictBanner.toneClasses}`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">
                        {verdictBanner.label}
                      </span>
                      <span className="font-mono-num text-xs font-bold px-2.5 py-0.5 rounded-lg bg-black/5 dark:bg-white/10">
                        Nota {evaluation.overallScore}/100
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm leading-snug opacity-95">
                      {evaluation.coachSummaryPtBr}
                    </p>
                  </div>

                  {xpAwardState && xpAwardState.awardedXp > 0 ? (
                    <div className="ewm-float-xp inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#28665E] text-white text-xs font-bold shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>+{xpAwardState.awardedXp} XP no Ranking</span>
                    </div>
                  ) : xpAwardState?.alreadyRewardedToday &&
                    evaluation.verdict !== 'NEEDS_PRACTICE' ? (
                    <span className="text-[11px] font-medium opacity-80">
                      XP desta frase já contabilizado hoje ✓
                    </span>
                  ) : null}
                </div>

                {/* Interactive Word-by-Word Chips */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B655C] dark:text-[#A39E93]">
                    <span className="font-semibold">
                      Diagnóstico palavra por palavra (toque em qualquer palavra para ouvir e ver a posição da língua):
                    </span>
                    {evaluation.heardTranscript && (
                      <span className="font-mono-num">
                        Ouvido: &ldquo;{evaluation.heardTranscript}&rdquo;
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {evaluation.wordBreakdown.map((item, idx) => {
                      const isSelected = (selectedWordIdx ?? 0) === idx;
                      const chipClasses =
                        item.status === 'EXACT'
                          ? 'border-[#A8D5BA] dark:border-[#2F5E46] bg-[#EDF8F2] dark:bg-[#192D23] text-[#1D5B3B] dark:text-[#7FE0AA]'
                          : item.status === 'CLOSE_NEEDS_POLISH'
                          ? 'border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] text-[#9A5B13] dark:text-[#E6B472]'
                          : 'border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] text-[#A63A32] dark:text-[#F0948D]';
                      const iconDot =
                        item.status === 'EXACT'
                          ? '🟢'
                          : item.status === 'CLOSE_NEEDS_POLISH'
                          ? '🟡'
                          : '🔴';

                      const chipSourceId = `speaking-word-chip-${idx}`;
                      const chipAudioState = getAudioButtonVisualState(activeAudio, {
                        text: item.word,
                        accent: accentUi,
                        sourceId: chipSourceId,
                      });

                      return (
                        <button
                          key={`${item.word}-${idx}`}
                          type="button"
                          data-testid={`diagnostic-word-chip-${idx}`}
                          aria-pressed={chipAudioState !== 'idle'}
                          onClick={() => {
                            setSelectedWordIdx(idx);
                            handleSpeakNative(item.word, {
                              sourceId: chipSourceId,
                              role: 'term',
                            });
                          }}
                          className={`min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${chipClasses} ${stateMotionClass(
                            chipAudioState
                          )} ${
                            isSelected
                              ? 'ring-2 ring-[#28665E] dark:ring-[#68B4A8] scale-[1.02]'
                              : 'hover:opacity-90'
                          }`}
                        >
                          <span className="text-xs">{iconDot}</span>
                          <span>{item.word}</span>
                          <AudioStatusIcon
                            state={chipAudioState}
                            idleClassName="w-3.5 h-3.5 opacity-70 shrink-0"
                            activeClassName="w-3.5 h-3"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Practical Portuguese Mouth/Tongue Articulation Card for Selected Word */}
                {activeWordItem && (
                  <div
                    data-testid="speaking-word-articulation-card"
                    className="rounded-2xl border border-[#DCE5E2] dark:border-[#2F4B46] bg-[#F4F8F7] dark:bg-[#192724] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold text-[#1C1B18] dark:text-[#F3F1EC]">
                          {activeWordItem.word}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/80 dark:bg-[#243632] text-xs font-mono-num font-semibold text-[#225851] dark:text-[#86CEC2]">
                          Como soar: {activeWordItem.phoneticCuePtBr}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#28564F] dark:text-[#C5E8E1] leading-relaxed">
                        {activeWordItem.tipPtBr}
                      </p>
                    </div>

                    {(() => {
                      const wordCardState = getAudioButtonVisualState(activeAudio, {
                        text: activeWordItem.word,
                        accent: accentUi,
                        sourceId: 'speaking-word-card',
                      });
                      return (
                        <button
                          type="button"
                          aria-pressed={wordCardState !== 'idle'}
                          onClick={() =>
                            handleSpeakNative(activeWordItem.word, {
                              sourceId: 'speaking-word-card',
                              role: 'term',
                            })
                          }
                          className={`min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white text-xs font-semibold cursor-pointer shrink-0 ${stateMotionClass(
                            wordCardState
                          )}`}
                        >
                          <AudioStatusIcon
                            state={wordCardState}
                            idleClassName="w-3.5 h-3.5 shrink-0"
                            activeClassName="w-3.5 h-3"
                          />
                          <span>Ouvir &ldquo;{activeWordItem.word}&rdquo;</span>
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
        </>
      )}
    </section>
  );
});
