import { memo, type ReactNode } from 'react';
import { ArrowLeftRight, Gauge, Loader2, Mic, Volume2 } from 'lucide-react';
import type { EnglishAccent } from '../types/flashcard';
import {
  compareUsAndUkSpeech,
  getAudioButtonVisualState,
  toggleSpeakEnglishText,
  toggleSpeechSpeed,
  type ActiveAudioPlayback,
  type SpeechSpeed,
} from '../services/platform/speechService';
import { triggerTap } from '../services/platform/hapticsService';

export const AudioWaveIcon = memo(function AudioWaveIcon({
  className = 'w-4 h-4',
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end justify-center gap-[2px] shrink-0 ${className}`}
    >
      <span className="w-[2.5px] h-full rounded-full bg-current animate-soundbar-1" />
      <span className="w-[2.5px] h-full rounded-full bg-current animate-soundbar-2" />
      <span className="w-[2.5px] h-full rounded-full bg-current animate-soundbar-3" />
    </span>
  );
});

export const AudioStatusIcon = memo(function AudioStatusIcon({
  state,
  idleClassName = 'w-4 h-4 shrink-0',
  activeClassName = 'w-4 h-3.5',
  idleIcon,
}: {
  state: 'idle' | 'loading' | 'playing';
  idleClassName?: string;
  activeClassName?: string;
  idleIcon?: ReactNode;
}) {
  if (state === 'loading') {
    return <Loader2 aria-hidden="true" className={`${idleClassName} animate-spin`} />;
  }
  if (state === 'playing') {
    return <AudioWaveIcon className={activeClassName} />;
  }
  return <>{idleIcon ?? <Volume2 aria-hidden="true" className={idleClassName} />}</>;
});

interface CardTermAudioControlsProps {
  term: string;
  phoneticUs: string;
  phoneticUk: string;
  activeAudio: ActiveAudioPlayback | null;
  speed: SpeechSpeed;
  onSpeedChanged?: (next: SpeechSpeed) => void;
  onOpenPronunciation?: () => void;
  isPronunciationOpen?: boolean;
}

export const CardTermAudioControls = memo(function CardTermAudioControls({
  term,
  phoneticUs,
  phoneticUk,
  activeAudio,
  speed,
  onSpeedChanged,
  onOpenPronunciation,
  isPronunciationOpen = false,
}: CardTermAudioControlsProps) {
  const phoneticUsState = getAudioButtonVisualState(activeAudio, {
    text: term,
    accent: 'us',
    sourceId: 'card-phonetic-us',
  });
  const phoneticUkState = getAudioButtonVisualState(activeAudio, {
    text: term,
    accent: 'uk',
    sourceId: 'card-phonetic-uk',
  });
  const mainUsState = getAudioButtonVisualState(activeAudio, {
    text: term,
    accent: 'us',
    sourceId: 'card-main-us',
  });
  const mainUkState = getAudioButtonVisualState(activeAudio, {
    text: term,
    accent: 'uk',
    sourceId: 'card-main-uk',
  });
  const compareState = getAudioButtonVisualState(activeAudio, {
    text: term,
    isComparing: true,
    sourceId: 'card-main-compare',
  });

  const isActivePhoneticUs = phoneticUsState !== 'idle';
  const isActivePhoneticUk = phoneticUkState !== 'idle';
  const isActiveMainUs = mainUsState !== 'idle';
  const isActiveMainUk = mainUkState !== 'idle';
  const isComparingTerm = compareState !== 'idle';
  const isSlow = speed === 'slow';

  const handleToggleSpeed = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void triggerTap();
    const next = toggleSpeechSpeed();
    onSpeedChanged?.(next);
  };

  return (
    <div
      className="space-y-2 sm:space-y-3 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clean Unboxed Comparative US & UK Phonetics */}
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 sm:gap-x-3 gap-y-0.5 text-[11px] sm:text-[13px] font-mono-num">
        <button
          type="button"
          aria-pressed={isActivePhoneticUs}
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(term, 'us', {
              speed,
              role: 'term',
              sourceId: 'card-phonetic-us',
            });
          }}
          title="Clique para ouvir a pronúncia americana (en-US)"
          className={`min-h-[30px] sm:min-h-[36px] inline-flex items-center gap-1 px-1 transition-opacity cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28665E] ${
            phoneticUsState === 'loading' ? 'ewm-audio-loading' : ''
          } ${
            isActivePhoneticUs
              ? 'text-[#184942] dark:text-[#9FE5D9] font-semibold underline decoration-2 underline-offset-4'
              : isActivePhoneticUk
              ? 'text-[#225851]/60 dark:text-[#86CEC2]/60 hover:opacity-100'
              : 'text-[#225851] dark:text-[#86CEC2] hover:underline underline-offset-4'
          }`}
        >
          {phoneticUsState === 'loading' && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
          {phoneticUsState === 'playing' && <AudioWaveIcon className="w-3 h-2.5" />}
          <span className="font-sans font-semibold">US</span>
          <span>{phoneticUs}</span>
        </button>

        <span aria-hidden="true" className="text-[#C6C0B4] dark:text-[#4D544D]">
          ·
        </span>

        <button
          type="button"
          aria-pressed={isActivePhoneticUk}
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(term, 'uk', {
              speed,
              role: 'term',
              sourceId: 'card-phonetic-uk',
            });
          }}
          title="Clique para ouvir a pronúncia britânica (en-GB)"
          className={`min-h-[30px] sm:min-h-[36px] inline-flex items-center gap-1 px-1 transition-opacity cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243B53] ${
            phoneticUkState === 'loading' ? 'ewm-audio-loading' : ''
          } ${
            isActivePhoneticUk
              ? 'text-[#1B324B] dark:text-[#B4D4F1] font-semibold underline decoration-2 underline-offset-4'
              : isActivePhoneticUs
              ? 'text-[#243B53]/60 dark:text-[#9CC3E6]/60 hover:opacity-100'
              : 'text-[#243B53] dark:text-[#9CC3E6] hover:underline underline-offset-4'
          }`}
        >
          {phoneticUkState === 'loading' && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
          {phoneticUkState === 'playing' && <AudioWaveIcon className="w-3 h-2.5" />}
          <span className="font-sans font-semibold">UK</span>
          <span>{phoneticUk}</span>
        </button>
      </div>

      {/* Aligned Compact Pill Controls: USA 🇺🇸 + UK 🇬🇧 + Circular 🎤 Button (Reference Layout) */}
      <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
        <button
          type="button"
          data-testid="card-audio-us"
          aria-pressed={isActiveMainUs}
          aria-busy={mainUsState === 'loading'}
          aria-label={
            isActiveMainUs
              ? `Parar áudio em inglês americano de ${term}`
              : `Ouvir ${term} em inglês americano`
          }
          title="Ouvir pronúncia nativa em Inglês Americano (Atalho U)"
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(term, 'us', {
              speed,
              role: 'term',
              sourceId: 'card-main-us',
            });
          }}
          className={`min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-[13px] font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C982] active:scale-[0.98] ${
            mainUsState === 'loading'
              ? 'ewm-audio-loading'
              : mainUsState === 'playing'
              ? 'ewm-audio-playing'
              : ''
          } ${
            isActiveMainUs
              ? 'bg-[#00C982] dark:bg-[#38E5A5] text-[#05291D] border border-[#00C982] dark:border-[#38E5A5] shadow-[0_0_16px_rgba(56,229,165,0.38)]'
              : 'bg-[#EFF8F5] hover:bg-[#E1F4EC] dark:bg-[#1E2833] dark:hover:bg-[#253240] text-[#0F3D30] dark:text-[#E2E8F0] border border-[#10D990]/35 dark:border-[#38E5A5]/28'
          }`}
        >
          <AudioStatusIcon state={mainUsState} idleClassName="w-3.5 h-3.5 shrink-0 text-[#00C982] dark:text-[#38E5A5]" activeClassName="w-3.5 h-3.5" />
          <span>
            {mainUsState === 'loading'
              ? 'US...'
              : mainUsState === 'playing'
              ? 'USA 🇺🇸'
              : 'USA 🇺🇸'}
          </span>
          {!isActiveMainUs && (
            <span className="hidden md:inline font-mono-num text-[10px] opacity-60">
              [U]
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="card-audio-uk"
          aria-pressed={isActiveMainUk}
          aria-busy={mainUkState === 'loading'}
          aria-label={
            isActiveMainUk
              ? `Parar áudio em inglês britânico de ${term}`
              : `Ouvir ${term} em inglês britânico`
          }
          title="Ouvir pronúncia nativa em Inglês Britânico (Atalho B)"
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(term, 'uk', {
              speed,
              role: 'term',
              sourceId: 'card-main-uk',
            });
          }}
          className={`min-h-[42px] sm:min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-[13px] font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38BDF8] active:scale-[0.98] ${
            mainUkState === 'loading'
              ? 'ewm-audio-loading'
              : mainUkState === 'playing'
              ? 'ewm-audio-playing'
              : ''
          } ${
            isActiveMainUk
              ? 'bg-[#0284C7] dark:bg-[#0EA5E9] text-white border border-[#38BDF8] shadow-[0_0_16px_rgba(56,189,248,0.38)]'
              : 'bg-[#F0F7FC] hover:bg-[#E1EFF9] dark:bg-[#1E2833] dark:hover:bg-[#253240] text-[#0F3352] dark:text-[#E2E8F0] border border-[#38BDF8]/35 dark:border-[#38BDF8]/25'
          }`}
        >
          <AudioStatusIcon state={mainUkState} idleClassName="w-3.5 h-3.5 shrink-0 text-[#0284C7] dark:text-[#38BDF8]" activeClassName="w-3.5 h-3.5" />
          <span>
            {mainUkState === 'loading'
              ? 'UK...'
              : mainUkState === 'playing'
              ? 'UK 🇬🇧'
              : 'UK 🇬🇧'}
          </span>
          {!isActiveMainUk && (
            <span className="hidden md:inline font-mono-num text-[10px] opacity-60">
              [B]
            </span>
          )}
        </button>

        {onOpenPronunciation && (
          <button
            type="button"
            data-testid="card-pronunciation-mic-front"
            aria-pressed={isPronunciationOpen}
            aria-label={`Treinar pronúncia de ${term}`}
            title="Treinar pronúncia com avaliação acústica IA"
            onClick={(e) => {
              e.stopPropagation();
              void triggerTap();
              onOpenPronunciation();
            }}
            className={`w-[42px] h-[42px] sm:w-[44px] sm:h-[44px] inline-flex items-center justify-center rounded-full border transition-all shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C982] ${
              isPronunciationOpen
                ? 'bg-[#00C982] dark:bg-[#38E5A5] text-[#05291D] border-[#00C982] dark:border-[#38E5A5] shadow-[0_0_18px_rgba(56,229,165,0.45)]'
                : 'bg-[#FEF3C7]/85 hover:bg-[#FDE68A] dark:bg-[#2E2516] dark:hover:bg-[#3B2F1B] text-[#D97706] dark:text-[#FBBF24] border-[#F59E0B]/45 dark:border-[#FBBF24]/35 shadow-[0_0_12px_rgba(251,191,36,0.16)]'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" />
          </button>
        )}
      </div>

      {/* Secondary Speech Study Controls: Sequential US -> UK Comparison & Cadence Speed */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          data-testid="card-audio-compare"
          aria-pressed={isComparingTerm}
          aria-busy={compareState === 'loading'}
          aria-label={
            isComparingTerm
              ? `Parar comparação de sotaques de ${term}`
              : `Comparar pronúncia americana e britânica de ${term}`
          }
          title="Ouvir em sequência: Inglês Americano seguido de Inglês Britânico (Atalho C)"
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void compareUsAndUkSpeech(term, term, {
              speed,
              role: 'term',
              sourceId: 'card-main-compare',
            });
          }}
          className={`min-h-[34px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C982] ${
            compareState === 'loading'
              ? 'ewm-audio-loading'
              : compareState === 'playing'
              ? 'ewm-audio-playing'
              : ''
          } ${
            isComparingTerm
              ? 'bg-[#00C982] dark:bg-[#38E5A5] text-[#05291D] font-bold'
              : 'bg-[#F1F7F5] hover:bg-[#E4F2ED] dark:bg-[#19232E] dark:hover:bg-[#202D3B] text-[#475550] dark:text-[#B5C4BE] border border-[#DCE8E3] dark:border-[#283645]'
          }`}
        >
          <AudioStatusIcon
            state={compareState}
            idleClassName="w-3.5 h-3.5 shrink-0"
            activeClassName="w-3.5 h-3"
            idleIcon={<ArrowLeftRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
          />
          <span>
            {compareState === 'loading'
              ? 'Carregando US → UK...'
              : compareState === 'playing'
              ? 'Comparando US → UK...'
              : 'Comparar US → UK'}
          </span>
          {!isComparingTerm && (
            <span className="hidden md:inline font-mono-num text-[10px] opacity-60">
              [C]
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="card-audio-speed"
          aria-pressed={isSlow}
          aria-label={
            isSlow
              ? 'Velocidade lenta 0.7x ativada. Clique para velocidade normal 1x'
              : 'Velocidade normal 1x. Clique para ouvir devagar em 0.7x'
          }
          title="Alternar velocidade da voz entre Normal (1x) e Lenta didática (0.7x) (Atalho S)"
          onClick={handleToggleSpeed}
          className={`min-h-[34px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C982] ${
            isSlow
              ? 'bg-[#FEF3C7] hover:bg-[#FDE68A] dark:bg-[#2E2516] dark:hover:bg-[#3A2E1B] text-[#9A5B13] dark:text-[#FBBF24] border border-[#F59E0B]/40 dark:border-[#FBBF24]/35 font-semibold'
              : 'bg-[#F1F7F5] hover:bg-[#E4F2ED] dark:bg-[#19232E] dark:hover:bg-[#202D3B] text-[#475550] dark:text-[#B5C4BE] border border-[#DCE8E3] dark:border-[#283645]'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 shrink-0 opacity-85" />
          <span className="font-mono-num">{isSlow ? '0.7x Lento' : '1x Normal'}</span>
        </button>
      </div>
    </div>
  );
});

interface BackFaceTermAudioControlsProps {
  term: string;
  activeAudio: ActiveAudioPlayback | null;
  speed: SpeechSpeed;
  onSpeedChanged?: (next: SpeechSpeed) => void;
  onOpenPronunciation?: () => void;
  isPronunciationOpen?: boolean;
}

export const BackFaceTermAudioControls = memo(function BackFaceTermAudioControls({
  term,
  activeAudio,
  speed,
  onSpeedChanged,
  onOpenPronunciation,
  isPronunciationOpen = false,
}: BackFaceTermAudioControlsProps) {
  const usState = getAudioButtonVisualState(activeAudio, {
    text: term,
    accent: 'us',
    sourceId: 'card-back-us',
  });
  const ukState = getAudioButtonVisualState(activeAudio, {
    text: term,
    accent: 'uk',
    sourceId: 'card-back-uk',
  });
  const isActiveUs = usState !== 'idle';
  const isActiveUk = ukState !== 'idle';
  const isSlow = speed === 'slow';

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs font-semibold text-[#5C574E] dark:text-[#BEB9AE] mr-0.5">
        {term}
      </span>

      <button
        type="button"
        aria-pressed={isActiveUs}
        aria-busy={usState === 'loading'}
        aria-label={`Ouvir ${term} em inglês americano no verso`}
        title="Ouvir em Inglês Americano (en-US)"
        onClick={(e) => {
          e.stopPropagation();
          void triggerTap();
          void toggleSpeakEnglishText(term, 'us', {
            speed,
            role: 'term',
            sourceId: 'card-back-us',
          });
        }}
        className={`min-h-[40px] lg:min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          usState === 'loading'
            ? 'ewm-audio-loading'
            : usState === 'playing'
            ? 'ewm-audio-playing'
            : ''
        } ${
          isActiveUs
            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2] border border-[#C2DAD5] dark:border-[#2F4B46]'
        }`}
      >
        <AudioStatusIcon state={usState} idleClassName="w-3 h-3 shrink-0" activeClassName="w-3 h-3" />
        <span>{isActiveUs ? 'US...' : 'US'}</span>
      </button>

      <button
        type="button"
        aria-pressed={isActiveUk}
        aria-busy={ukState === 'loading'}
        aria-label={`Ouvir ${term} em inglês britânico no verso`}
        title="Ouvir em Inglês Britânico (en-GB)"
        onClick={(e) => {
          e.stopPropagation();
          void triggerTap();
          void toggleSpeakEnglishText(term, 'uk', {
            speed,
            role: 'term',
            sourceId: 'card-back-uk',
          });
        }}
        className={`min-h-[40px] lg:min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          ukState === 'loading'
            ? 'ewm-audio-loading'
            : ukState === 'playing'
            ? 'ewm-audio-playing'
            : ''
        } ${
          isActiveUk
            ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
            : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6] border border-[#C9D5E2] dark:border-[#334354]'
        }`}
      >
        <AudioStatusIcon state={ukState} idleClassName="w-3 h-3 shrink-0" activeClassName="w-3 h-3" />
        <span>{isActiveUk ? 'UK...' : 'UK'}</span>
      </button>

      <button
        type="button"
        aria-pressed={isSlow}
        aria-label={
          isSlow
            ? 'Velocidade lenta 0.7x ativada no verso'
            : 'Ativar velocidade lenta 0.7x no verso'
        }
        title="Alternar velocidade 1x / 0.7x"
        onClick={(e) => {
          e.stopPropagation();
          void triggerTap();
          const next = toggleSpeechSpeed();
          onSpeedChanged?.(next);
        }}
        className={`min-h-[40px] lg:min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-mono-num font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isSlow
            ? 'bg-[#FDF5E8] dark:bg-[#2F261A] text-[#9A5B13] dark:text-[#E6B472] border border-[#E5C9A3] dark:border-[#574328]'
            : 'bg-[#F0EDE6] hover:bg-[#E5E0D5] dark:bg-[#2B302B] dark:hover:bg-[#343A34] text-[#5C574E] dark:text-[#AFAAA0]'
        }`}
      >
        {isSlow ? '0.7x' : '1x'}
      </button>

      {onOpenPronunciation && (
        <button
          type="button"
          data-testid="card-pronunciation-mic-back"
          aria-pressed={isPronunciationOpen}
          aria-label={`Treinar pronúncia de ${term} no verso`}
          title="Treinar pronúncia (🎤)"
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            onOpenPronunciation();
          }}
          className={`min-h-[40px] lg:min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isPronunciationOpen
              ? 'bg-[#28665E] text-white dark:bg-[#2EA98C] dark:text-[#0E1715]'
              : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2] border border-[#C2DAD5] dark:border-[#2F4B46]'
          }`}
        >
          <Mic className="w-3 h-3 shrink-0" />
          <span>🎤</span>
        </button>
      )}
    </div>
  );
});

interface SentenceAudioButtonsProps {
  sentence: string;
  indexLabel: string;
  faceLabel?: string;
  sourcePrefix?: string;
  compact?: boolean;
  activeAudio: ActiveAudioPlayback | null;
  speed: SpeechSpeed;
  onOpenPronunciation?: () => void;
}

export const SentenceAudioButtons = memo(function SentenceAudioButtons({
  sentence,
  indexLabel,
  faceLabel,
  sourcePrefix,
  compact = false,
  activeAudio,
  speed,
  onOpenPronunciation,
}: SentenceAudioButtonsProps) {
  const prefix = sourcePrefix ?? `sentence-${faceLabel || 'card'}-${indexLabel}`;
  const usSourceId = `${prefix}-us`;
  const ukSourceId = `${prefix}-uk`;

  const usState = getAudioButtonVisualState(activeAudio, {
    text: sentence,
    accent: 'us',
    sourceId: usSourceId,
  });
  const ukState = getAudioButtonVisualState(activeAudio, {
    text: sentence,
    accent: 'uk',
    sourceId: ukSourceId,
  });

  const activeUs = usState !== 'idle';
  const activeUk = ukState !== 'idle';
  const suffix = faceLabel ? ` (${faceLabel})` : '';
  const sizeClasses = compact
    ? 'min-h-[32px] lg:min-h-[28px] px-2 sm:px-2.5 py-0.5 rounded-md text-[10px]'
    : 'min-h-[34px] sm:min-h-[40px] lg:min-h-[32px] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px]';

  const resolveStateClass = (state: 'idle' | 'loading' | 'playing') =>
    state === 'loading'
      ? 'ewm-audio-loading'
      : state === 'playing'
      ? 'ewm-audio-playing'
      : '';

  return (
    <div
      className="inline-flex items-center gap-1.5 shrink-0 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-pressed={activeUs}
        aria-busy={usState === 'loading'}
        aria-label={
          activeUs
            ? `Parar áudio da frase ${indexLabel} em inglês americano${suffix}`
            : `Ouvir frase ${indexLabel} em inglês americano${suffix}`
        }
        title={`Ouvir frase completa ${indexLabel} em Inglês Americano (en-US)`}
        onClick={(e) => {
          e.stopPropagation();
          void triggerTap();
          void toggleSpeakEnglishText(sentence, 'us', {
            speed,
            role: 'sentence',
            sourceId: usSourceId,
          });
        }}
        className={`inline-flex items-center gap-1 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${sizeClasses} ${resolveStateClass(
          usState
        )} ${
          activeUs
            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2]'
        }`}
      >
        <AudioStatusIcon
          state={usState}
          idleClassName={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'}
          activeClassName={compact ? 'w-3 h-2.5' : 'w-3.5 h-3'}
        />
        <span>US</span>
      </button>

      <button
        type="button"
        aria-pressed={activeUk}
        aria-busy={ukState === 'loading'}
        aria-label={
          activeUk
            ? `Parar áudio da frase ${indexLabel} em inglês britânico${suffix}`
            : `Ouvir frase ${indexLabel} em inglês britânico${suffix}`
        }
        title={`Ouvir frase completa ${indexLabel} em Inglês Britânico (en-GB)`}
        onClick={(e) => {
          e.stopPropagation();
          void triggerTap();
          void toggleSpeakEnglishText(sentence, 'uk', {
            speed,
            role: 'sentence',
            sourceId: ukSourceId,
          });
        }}
        className={`inline-flex items-center gap-1 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${sizeClasses} ${resolveStateClass(
          ukState
        )} ${
          activeUk
            ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
            : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6]'
        }`}
      >
        <AudioStatusIcon
          state={ukState}
          idleClassName={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'}
          activeClassName={compact ? 'w-3 h-2.5' : 'w-3.5 h-3'}
        />
        <span>UK</span>
      </button>

      {onOpenPronunciation && (
        <button
          type="button"
          aria-label={`Treinar pronúncia da frase ${indexLabel}${suffix}`}
          title="Treinar pronúncia desta frase (🎤)"
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            onOpenPronunciation();
          }}
          className={`inline-flex items-center justify-center font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${sizeClasses} bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2]`}
        >
          <Mic className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>
      )}
    </div>
  );
});
