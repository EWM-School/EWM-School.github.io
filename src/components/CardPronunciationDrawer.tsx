import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mic,
  Square,
  Play,
  Volume2,
  X,
  RotateCcw,
  WifiOff,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { EnglishAccent, Flashcard } from '../types/flashcard';
import { useAcousticRecorder } from '../hooks/useAcousticRecorder';
import {
  getSelectedVoiceLocale,
  stopCurrentAudio,
  subscribeAudioPlayback,
  switchVoiceLocale,
  toggleSpeakEnglishText,
  type ActiveAudioPlayback,
} from '../services/platform/speechService';
import { triggerError, triggerSuccess, triggerTap } from '../services/platform/hapticsService';
import type {
  PronunciationEvaluationResult,
  WordBreakdownItem,
} from '../utils/pronunciationEngine';

export type CardPronunciationTargetKind = 'term' | 'example';

export interface CardPronunciationSession {
  card: Flashcard;
  initialTarget: CardPronunciationTargetKind;
  overrideExampleEn?: string;
  overrideExamplePt?: string;
}

interface CardPronunciationDrawerProps {
  session: CardPronunciationSession | null;
  variant?: 'inline' | 'sheet';
  onClose: () => void;
  onPronunciationEvaluated?: (
    result: PronunciationEvaluationResult,
    targetText: string
  ) => { awardedXp: number; alreadyRewardedToday: boolean } | void;
}

export const CardPronunciationDrawer = memo(function CardPronunciationDrawer({
  session,
  variant = 'inline',
  onClose,
  onPronunciationEvaluated,
}: CardPronunciationDrawerProps) {
  const [targetKind, setTargetKind] = useState<CardPronunciationTargetKind>(
    session?.initialTarget || 'term'
  );
  const [accentUi, setAccentUi] = useState<EnglishAccent>(() =>
    getSelectedVoiceLocale()
  );
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);
  const [xpBadgeDelta, setXpBadgeDelta] = useState<number>(0);
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(null);

  useEffect(() => subscribeAudioPlayback(setActiveAudio), []);

  useEffect(() => {
    if (session) {
      setTargetKind(session.initialTarget);
      setSelectedWordIdx(null);
      setXpBadgeDelta(0);
    }
  }, [session]);

  const card = session?.card || null;
  const exampleSentenceEn = session?.overrideExampleEn || card?.exampleEn || '';
  const exampleSentencePt = session?.overrideExamplePt || card?.examplePt || '';

  const targetText = useMemo(() => {
    if (!card) return '';
    return targetKind === 'example' && exampleSentenceEn.trim()
      ? exampleSentenceEn.trim()
      : card.term.trim();
  }, [card, targetKind, exampleSentenceEn]);

  const targetTranslationPt = useMemo(() => {
    if (!card) return '';
    return targetKind === 'example' && exampleSentencePt.trim()
      ? exampleSentencePt.trim()
      : card.colloquial?.[0] || card.literal || '';
  }, [card, targetKind, exampleSentencePt]);

  const bcp47Accent = accentUi === 'uk' ? 'en-GB' : 'en-US';

  const handleEvaluated = useCallback(
    (result: PronunciationEvaluationResult, evaluatedText: string) => {
      if (result.audioQualityStatus === 'CLEAR') {
        const firstNonExactIdx = result.wordBreakdown.findIndex(
          (w) => w.status !== 'EXACT'
        );
        setSelectedWordIdx(firstNonExactIdx >= 0 ? firstNonExactIdx : 0);

        if (result.verdict === 'NEEDS_PRACTICE') {
          void triggerError();
        } else {
          void triggerSuccess();
        }
      } else {
        setSelectedWordIdx(null);
        void triggerError();
      }

      const xpOutcome = onPronunciationEvaluated?.(result, evaluatedText);
      if (xpOutcome && xpOutcome.awardedXp > 0) {
        setXpBadgeDelta(xpOutcome.awardedXp);
      } else {
        setXpBadgeDelta(0);
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
    cancelEverything,
  } = useAcousticRecorder({
    targetText,
    accent: bcp47Accent,
    mode: 'card-quick',
    maxDurationMs: 10000,
    onEvaluated: handleEvaluated,
  });

  const handleClose = useCallback(() => {
    cancelEverything();
    stopCurrentAudio();
    onClose();
  }, [cancelEverything, onClose]);

  const handleSwitchAccent = useCallback((next: EnglishAccent) => {
    void triggerTap();
    setAccentUi(next);
    switchVoiceLocale(next);
  }, []);

  const handleListenNative = useCallback(
    (textToSpeak: string) => {
      void triggerTap();
      stopOwnPlayback();
      void toggleSpeakEnglishText(textToSpeak, accentUi, { speed: 'normal' });
    },
    [accentUi, stopOwnPlayback]
  );

  if (!session || !card) return null;

  const isRecording = status === 'recording';
  const isEvaluating = status === 'evaluating';
  const isRequestingMic = status === 'requesting_mic';
  const isPlayingNativeTarget = Boolean(
    activeAudio &&
      activeAudio.accent === accentUi &&
      activeAudio.text.toLowerCase() === targetText.toLowerCase()
  );

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

  const verdictUi =
    evaluation && evaluation.audioQualityStatus === 'CLEAR'
      ? evaluation.verdict === 'NATIVE_LIKE'
        ? {
            badge: '🟢 Pronúncia Natural',
            classes:
              'border-[#A8D5BA] dark:border-[#2F5E46] bg-[#EDF8F2] dark:bg-[#192D23] text-[#1D5B3B] dark:text-[#7FE0AA]',
          }
        : evaluation.verdict === 'UNDERSTANDABLE_POLISH'
        ? {
            badge: '🟡 Compreensível · Ajustar sotaque',
            classes:
              'border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] text-[#9A5B13] dark:text-[#E6B472]',
          }
        : {
            badge: '🔴 Precisa praticar',
            classes:
              'ewm-micro-shake border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] text-[#A63A32] dark:text-[#F0948D]',
          }
      : null;

  const panelBody = (
    <div
      onClick={(e) => e.stopPropagation()}
      data-testid="card-pronunciation-drawer"
      className="rounded-2xl border border-[#CFE2DD] dark:border-[#2F4B46] bg-white dark:bg-[#1E2320] p-3.5 sm:p-4 shadow-md space-y-3 ewm-pillar-enter"
    >
      {/* Top Bar: Target Selector + Accent Toggle + Close */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#28665E] dark:text-[#68B4A8] mr-1">
            <Mic className="w-3.5 h-3.5" />
            <span>Micro-Treino</span>
          </span>

          <div className="inline-flex p-0.5 rounded-xl bg-[#F0EDE6] dark:bg-[#282D28] border border-[#E4E0D8] dark:border-[#343A34]">
            <button
              type="button"
              onClick={() => {
                void triggerTap();
                setTargetKind('term');
                setSelectedWordIdx(null);
                setXpBadgeDelta(0);
              }}
              className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                targetKind === 'term'
                  ? 'bg-white dark:bg-[#1E2320] text-[#1C1B18] dark:text-[#F1EFEA] shadow-2xs'
                  : 'text-[#6B655C] dark:text-[#A39E93]'
              }`}
            >
              Expressão principal
            </button>
            {exampleSentenceEn && (
              <button
                type="button"
                onClick={() => {
                  void triggerTap();
                  setTargetKind('example');
                  setSelectedWordIdx(null);
                  setXpBadgeDelta(0);
                }}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  targetKind === 'example'
                    ? 'bg-white dark:bg-[#1E2320] text-[#1C1B18] dark:text-[#F1EFEA] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#A39E93]'
                }`}
              >
                Frase de exemplo
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex p-0.5 rounded-xl bg-[#F0EDE6] dark:bg-[#282D28] border border-[#E4E0D8] dark:border-[#343A34]">
            <button
              type="button"
              onClick={() => handleSwitchAccent('us')}
              className={`min-h-[28px] px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                accentUi === 'us'
                  ? 'bg-[#28665E] text-white'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              🇺🇸 US
            </button>
            <button
              type="button"
              onClick={() => handleSwitchAccent('uk')}
              className={`min-h-[28px] px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                accentUi === 'uk'
                  ? 'bg-[#243B53] text-white'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              🇬🇧 UK
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar treino de pronúncia"
            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-xl text-[#7D776C] dark:text-[#9C978C] hover:bg-[#F2EFE9] dark:hover:bg-[#2A2F2A] hover:text-[#1C1B18] dark:hover:text-[#F1EFEA] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Phrase + Record Control Row */}
      <div className="rounded-xl border border-[#ECE8DF] dark:border-[#2D332D] bg-[#FAF8F4] dark:bg-[#181B18] px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#F3F1EC] leading-snug break-words">
            {targetText}
          </p>
          {targetTranslationPt && (
            <p className="text-xs text-[#6B655C] dark:text-[#A39E93] leading-snug">
              {targetTranslationPt}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleListenNative(targetText)}
            title="Ouvir modelo nativo antes de gravar"
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isPlayingNativeTarget
                ? 'bg-[#28665E] text-white border-[#28665E]'
                : 'bg-white dark:bg-[#232824] border-[#D6D1C7] dark:border-[#343A34] text-[#28665E] dark:text-[#86CEC2] hover:bg-[#EAF3F1] dark:hover:bg-[#283834]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isPlayingNativeTarget ? 'Ouvindo...' : 'Ouvir Nativo'}</span>
          </button>

          <button
            type="button"
            disabled={isEvaluating || isRequestingMic}
            onClick={() => {
              void triggerTap();
              if (isRecording) {
                stopRecording();
              } else {
                setXpBadgeDelta(0);
                void startRecording();
              }
            }}
            data-testid="inline-record-mic-btn"
            className={`min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              isRecording
                ? 'ewm-breathing-ring bg-[#B5443C] hover:bg-[#9E3831] text-white'
                : isEvaluating || isRequestingMic
                ? 'bg-[#E5E0D5] dark:bg-[#2B302B] text-[#7D776C] dark:text-[#989388] cursor-wait'
                : 'bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2EA98C] dark:hover:bg-[#27947A] text-white dark:text-[#0E1715]'
            }`}
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Avaliando...</span>
              </>
            ) : isRecording ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="font-mono-num">
                  Parar ({Math.min(10, Math.ceil((maxDurationMs - elapsedMs) / 1000))}s)
                </span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>{evaluation || recordedUrl ? 'Regravar' : 'Gravar Voz'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Voice Level Meter while Recording */}
      {isRecording && (
        <div className="rounded-xl bg-[#162420] text-[#D7F5EC] px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#3CE0B5] animate-ping shrink-0" />
            <span className="text-xs font-medium truncate">
              Fale naturalmente em {accentUi === 'uk' ? 'Inglês Britânico' : 'Inglês Americano'}...
            </span>
          </div>
          <div className="flex items-end gap-0.5 h-5 shrink-0" aria-hidden="true">
            {waveformBars.slice(0, 12).map((bar, idx) => (
              <span
                key={idx}
                style={{
                  height: `${Math.max(20, Math.round(bar * 100))}%`,
                }}
                className="w-1 rounded-full bg-[#3CE0B5] transition-[height] duration-75"
              />
            ))}
          </div>
          <div className="w-16 h-1.5 rounded-full bg-white/15 overflow-hidden shrink-0">
            <div
              style={{ width: `${Math.round(Math.min(100, voiceLevel * 100))}%` }}
              className="h-full bg-[#3CE0B5] transition-[width] duration-75"
            />
          </div>
        </div>
      )}

      {/* Offline Banner (when offline before or after recording) */}
      {(!isOnline || offlineSelfCheckNotice) && (
        <div className="rounded-xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] px-3 py-2.5 flex items-start gap-2.5 text-xs text-[#8A5110] dark:text-[#E6B472]">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-snug">
            {offlineSelfCheckNotice ||
              'Modo offline ativo: a avaliação acústica profunda requer conexão, mas você pode gravar sua voz e comparar de ouvido com o áudio nativo em cache!'}
          </p>
        </div>
      )}

      {/* Friendly Microphone Permission Instructions */}
      {micError && (
        <div className="rounded-xl border border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#A63A32] dark:text-[#F0948D]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">{micError.titlePtBr}</p>
            <p className="leading-snug opacity-90">{micError.instructionsPtBr}</p>
          </div>
        </div>
      )}

      {networkError && (
        <div className="rounded-xl border border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#A63A32] dark:text-[#F0948D]">
          <span>{networkError}</span>
        </div>
      )}

      {/* Non-CLEAR Audio Guard Result (Silence / Noise / Wrong Language) */}
      {evaluation && evaluation.audioQualityStatus !== 'CLEAR' && (
        <div className="ewm-micro-shake rounded-xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9A5B13] dark:text-[#E6B472]">
          <span>{evaluation.coachSummaryPtBr}</span>
          <button
            type="button"
            onClick={() => void startRecording()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#9A5B13] text-white font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* CLEAR Evaluation Result: Colored Words + 1-Line Tip + Side-by-Side Minha Voz vs Ouvir Nativo */}
      {evaluation && evaluation.audioQualityStatus === 'CLEAR' && verdictUi && (
        <div className="space-y-2.5">
          <div
            className={`relative rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold ${verdictUi.classes}`}
          >
            <div className="flex items-center gap-2">
              <span>{verdictUi.badge}</span>
              <span className="font-mono-num px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10">
                {evaluation.overallScore}/100
              </span>
            </div>
            {xpBadgeDelta > 0 && (
              <span className="ewm-float-xp inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#28665E] text-white text-[11px] font-bold">
                <Sparkles className="w-3 h-3" />
                +{xpBadgeDelta} XP
              </span>
            )}
          </div>

          {/* Colored Word Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {evaluation.wordBreakdown.map((item, idx) => {
              const isSelected =
                (selectedWordIdx ?? 0) === idx;
              const chipTone =
                item.status === 'EXACT'
                  ? 'border-[#A8D5BA] dark:border-[#2F5E46] bg-[#EDF8F2] dark:bg-[#192D23] text-[#1D5B3B] dark:text-[#7FE0AA]'
                  : item.status === 'CLOSE_NEEDS_POLISH'
                  ? 'border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2B2318] text-[#9A5B13] dark:text-[#E6B472]'
                  : 'border-[#E6B8B5] dark:border-[#5B302D] bg-[#FDF2F2] dark:bg-[#2D1D1C] text-[#A63A32] dark:text-[#F0948D]';
              const dot =
                item.status === 'EXACT'
                  ? '🟢'
                  : item.status === 'CLOSE_NEEDS_POLISH'
                  ? '🟡'
                  : '🔴';

              return (
                <button
                  key={`${item.word}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedWordIdx(idx);
                    handleListenNative(item.word);
                  }}
                  title="Toque para ouvir esta palavra e ver a dica fonética"
                  className={`min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${chipTone} ${
                    isSelected ? 'ring-2 ring-[#28665E]/50 dark:ring-[#68B4A8]/60' : ''
                  }`}
                >
                  <span className="text-[10px]">{dot}</span>
                  <span>{item.word}</span>
                </button>
              );
            })}
          </div>

          {/* 1-Line Portuguese Phonetic Tip */}
          <div className="rounded-xl bg-[#F4F2EC] dark:bg-[#252A26] px-3 py-2 text-xs text-[#3D3A34] dark:text-[#DEDAD0] space-y-0.5">
            {activeWordItem ? (
              <>
                <p className="font-semibold text-[#1C1B18] dark:text-[#F4F2EC]">
                  <span className="text-[#28665E] dark:text-[#68B4A8] mr-1.5">
                    {activeWordItem.word}:
                  </span>
                  <span className="font-normal opacity-90">
                    {activeWordItem.phoneticCuePtBr}
                  </span>
                </p>
                <p className="leading-snug">{activeWordItem.tipPtBr}</p>
              </>
            ) : (
              <p className="leading-snug">{evaluation.coachSummaryPtBr}</p>
            )}
          </div>
        </div>
      )}

      {/* Side-by-Side Pedagogical Comparison Buttons (Available both Online & Offline as soon as recordedUrl exists) */}
      {recordedUrl && (
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              togglePlayOwnRecording();
            }}
            data-testid="play-own-voice-btn"
            className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isPlayingOwnAudio
                ? 'bg-[#1C1B18] text-white border-[#1C1B18] dark:bg-[#EBE7DE] dark:text-[#1C1B18]'
                : 'bg-[#FAF8F4] hover:bg-[#F0EDE6] dark:bg-[#252A26] dark:hover:bg-[#2E342F] border-[#DFDAD0] dark:border-[#343A34] text-[#1C1B18] dark:text-[#EBE7DE]'
            }`}
          >
            <span>{isPlayingOwnAudio ? 'Ouvindo minha voz...' : '▶️ Minha Voz'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleListenNative(targetText)}
            data-testid="play-native-compare-btn"
            className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isPlayingNativeTarget
                ? 'bg-[#28665E] text-white border-[#28665E]'
                : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] border-[#C2DAD5] dark:border-[#2F4B46] text-[#1E4E47] dark:text-[#86CEC2]'
            }`}
          >
            <span>{isPlayingNativeTarget ? 'Ouvindo nativo...' : '🔊 Ouvir Nativo'}</span>
          </button>
        </div>
      )}
    </div>
  );

  if (variant === 'sheet') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Treinar pronúncia de ${card.term}`}
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-2.5 sm:p-4 ios-safe-bottom"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
        >
          {panelBody}
        </div>
      </div>
    );
  }

  return panelBody;
});
