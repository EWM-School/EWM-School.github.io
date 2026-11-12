import { memo } from 'react';
import { ArrowLeftRight, Gauge, Volume2 } from 'lucide-react';
import type { EnglishAccent } from '../types/flashcard';
import {
  cleanEnglishForSpeech,
  compareUsAndUkSpeech,
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

interface CardTermAudioControlsProps {
  term: string;
  phoneticUs: string;
  phoneticUk: string;
  activeAudio: ActiveAudioPlayback | null;
  speed: SpeechSpeed;
  onSpeedChanged?: (next: SpeechSpeed) => void;
}

export const CardTermAudioControls = memo(function CardTermAudioControls({
  term,
  phoneticUs,
  phoneticUk,
  activeAudio,
  speed,
  onSpeedChanged,
}: CardTermAudioControlsProps) {
  const cleanedTerm = cleanEnglishForSpeech(term);
  const isPlayingUs =
    Boolean(activeAudio) &&
    activeAudio?.accent === 'us' &&
    activeAudio?.text === cleanedTerm;
  const isPlayingUk =
    Boolean(activeAudio) &&
    activeAudio?.accent === 'uk' &&
    activeAudio?.text === cleanedTerm;
  const isComparingTerm =
    Boolean(activeAudio?.isComparing) && activeAudio?.text === cleanedTerm;
  const isSlow = speed === 'slow';

  const handleToggleSpeed = () => {
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
          onClick={() => {
            void triggerTap();
            void toggleSpeakEnglishText(term, 'us', { speed });
          }}
          title="Clique para ouvir a pronúncia americana (en-US)"
          className={`min-h-[30px] sm:min-h-[36px] inline-flex items-center gap-1 px-1 transition-opacity cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28665E] ${
            isPlayingUs
              ? 'text-[#184942] dark:text-[#9FE5D9] font-semibold underline decoration-2 underline-offset-4'
              : isPlayingUk
              ? 'text-[#225851]/60 dark:text-[#86CEC2]/60 hover:opacity-100'
              : 'text-[#225851] dark:text-[#86CEC2] hover:underline underline-offset-4'
          }`}
        >
          <span className="font-sans font-semibold">US</span>
          <span>{phoneticUs}</span>
        </button>

        <span aria-hidden="true" className="text-[#C6C0B4] dark:text-[#4D544D]">
          ·
        </span>

        <button
          type="button"
          onClick={() => {
            void triggerTap();
            void toggleSpeakEnglishText(term, 'uk', { speed });
          }}
          title="Clique para ouvir a pronúncia britânica (en-GB)"
          className={`min-h-[30px] sm:min-h-[36px] inline-flex items-center gap-1 px-1 transition-opacity cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243B53] ${
            isPlayingUk
              ? 'text-[#1B324B] dark:text-[#B4D4F1] font-semibold underline decoration-2 underline-offset-4'
              : isPlayingUs
              ? 'text-[#243B53]/60 dark:text-[#9CC3E6]/60 hover:opacity-100'
              : 'text-[#243B53] dark:text-[#9CC3E6] hover:underline underline-offset-4'
          }`}
        >
          <span className="font-sans font-semibold">UK</span>
          <span>{phoneticUk}</span>
        </button>
      </div>

      {/* Primary Clickable Hybrid Speech Buttons (US en-US & UK en-GB) — Ergonomic Mobile Scale */}
      <div className="grid grid-cols-2 sm:inline-flex items-center justify-center gap-2 sm:gap-2.5 w-full sm:w-auto max-w-md mx-auto">
        <button
          type="button"
          data-testid="card-audio-us"
          aria-pressed={isPlayingUs}
          aria-label={
            isPlayingUs
              ? `Parar áudio em inglês americano de ${term}`
              : `Ouvir ${term} em inglês americano`
          }
          title="Ouvir pronúncia nativa em Inglês Americano (Atalho U)"
          onClick={() => {
            void triggerTap();
            void toggleSpeakEnglishText(term, 'us', { speed });
          }}
          className={`min-h-[42px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28665E] active:scale-[0.98] ${
            isPlayingUs
              ? 'bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] border border-[#28665E] dark:border-[#3E8E82] shadow-xs'
              : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2] border border-[#C2DAD5] dark:border-[#2F4B46]'
          }`}
        >
          {isPlayingUs ? (
            <AudioWaveIcon className="w-4 h-3.5" />
          ) : (
            <Volume2 className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">
            {isPlayingUs ? (
              'Ouvindo US...'
            ) : (
              <>
                <span className="sm:hidden">Ouvir US</span>
                <span className="hidden sm:inline">Ouvir US · Americano</span>
              </>
            )}
          </span>
          {!isPlayingUs && (
            <span className="hidden md:inline font-mono-num text-[10px] opacity-65">
              [U]
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="card-audio-uk"
          aria-pressed={isPlayingUk}
          aria-label={
            isPlayingUk
              ? `Parar áudio em inglês britânico de ${term}`
              : `Ouvir ${term} em inglês britânico`
          }
          title="Ouvir pronúncia nativa em Inglês Britânico (Atalho B)"
          onClick={() => {
            void triggerTap();
            void toggleSpeakEnglishText(term, 'uk', { speed });
          }}
          className={`min-h-[42px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243B53] active:scale-[0.98] ${
            isPlayingUk
              ? 'bg-[#243B53] hover:bg-[#1B2D40] dark:bg-[#2E4C6B] dark:hover:bg-[#375A7F] text-white dark:text-[#F4F7F8] border border-[#243B53] dark:border-[#496F96] shadow-xs'
              : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6] border border-[#C9D5E2] dark:border-[#334354]'
          }`}
        >
          {isPlayingUk ? (
            <AudioWaveIcon className="w-4 h-3.5" />
          ) : (
            <Volume2 className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">
            {isPlayingUk ? (
              'Ouvindo UK...'
            ) : (
              <>
                <span className="sm:hidden">Ouvir UK</span>
                <span className="hidden sm:inline">Ouvir UK · Britânico</span>
              </>
            )}
          </span>
          {!isPlayingUk && (
            <span className="hidden md:inline font-mono-num text-[10px] opacity-65">
              [B]
            </span>
          )}
        </button>
      </div>

      {/* Secondary Speech Study Controls: Sequential US -> UK Comparison & Cadence Speed */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          data-testid="card-audio-compare"
          aria-pressed={isComparingTerm}
          aria-label={
            isComparingTerm
              ? `Parar comparação de sotaques de ${term}`
              : `Comparar pronúncia americana e britânica de ${term}`
          }
          title="Ouvir em sequência: Inglês Americano seguido de Inglês Britânico (Atalho C)"
          onClick={() => {
            void triggerTap();
            void compareUsAndUkSpeech(term, term, { speed });
          }}
          className={`min-h-[36px] lg:min-h-[34px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28665E] ${
            isComparingTerm
              ? 'bg-[#1C1B18] dark:bg-[#EBE7DE] text-[#F6F4EF] dark:text-[#181A18] font-semibold'
              : 'bg-[#F3F1EC] hover:bg-[#E7E3DA] dark:bg-[#282C28] dark:hover:bg-[#313631] text-[#4A463F] dark:text-[#C5C0B5] border border-[#E2DDD3] dark:border-[#343A34]'
          }`}
        >
          {isComparingTerm ? (
            <AudioWaveIcon className="w-3.5 h-3" />
          ) : (
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 opacity-80" />
          )}
          <span>{isComparingTerm ? 'Comparando US → UK...' : 'Comparar US → UK'}</span>
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
          className={`min-h-[36px] lg:min-h-[34px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28665E] ${
            isSlow
              ? 'bg-[#FDF5E8] hover:bg-[#FAEBCE] dark:bg-[#2F261A] dark:hover:bg-[#392E1F] text-[#9A5B13] dark:text-[#E6B472] border border-[#E5C9A3] dark:border-[#574328] font-semibold'
              : 'bg-[#F3F1EC] hover:bg-[#E7E3DA] dark:bg-[#282C28] dark:hover:bg-[#313631] text-[#4A463F] dark:text-[#C5C0B5] border border-[#E2DDD3] dark:border-[#343A34]'
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
}

export const BackFaceTermAudioControls = memo(function BackFaceTermAudioControls({
  term,
  activeAudio,
  speed,
  onSpeedChanged,
}: BackFaceTermAudioControlsProps) {
  const cleanedTerm = cleanEnglishForSpeech(term);
  const isPlayingUs =
    Boolean(activeAudio) &&
    activeAudio?.accent === 'us' &&
    activeAudio?.text === cleanedTerm;
  const isPlayingUk =
    Boolean(activeAudio) &&
    activeAudio?.accent === 'uk' &&
    activeAudio?.text === cleanedTerm;
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
        aria-pressed={isPlayingUs}
        aria-label={`Ouvir ${term} em inglês americano no verso`}
        title="Ouvir em Inglês Americano (en-US)"
        onClick={() => {
          void triggerTap();
          void toggleSpeakEnglishText(term, 'us', { speed });
        }}
        className={`min-h-[40px] lg:min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isPlayingUs
            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2] border border-[#C2DAD5] dark:border-[#2F4B46]'
        }`}
      >
        {isPlayingUs ? (
          <AudioWaveIcon className="w-3 h-3" />
        ) : (
          <Volume2 className="w-3 h-3 shrink-0" />
        )}
        <span>{isPlayingUs ? 'US...' : 'US'}</span>
      </button>

      <button
        type="button"
        aria-pressed={isPlayingUk}
        aria-label={`Ouvir ${term} em inglês britânico no verso`}
        title="Ouvir em Inglês Britânico (en-GB)"
        onClick={() => {
          void triggerTap();
          void toggleSpeakEnglishText(term, 'uk', { speed });
        }}
        className={`min-h-[40px] lg:min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isPlayingUk
            ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
            : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6] border border-[#C9D5E2] dark:border-[#334354]'
        }`}
      >
        {isPlayingUk ? (
          <AudioWaveIcon className="w-3 h-3" />
        ) : (
          <Volume2 className="w-3 h-3 shrink-0" />
        )}
        <span>{isPlayingUk ? 'UK...' : 'UK'}</span>
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
        onClick={() => {
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
    </div>
  );
});

interface SentenceAudioButtonsProps {
  sentence: string;
  indexLabel: string;
  faceLabel?: string;
  compact?: boolean;
  activeAudio: ActiveAudioPlayback | null;
  speed: SpeechSpeed;
}

export const SentenceAudioButtons = memo(function SentenceAudioButtons({
  sentence,
  indexLabel,
  faceLabel,
  compact = false,
  activeAudio,
  speed,
}: SentenceAudioButtonsProps) {
  const cleaned = cleanEnglishForSpeech(sentence);

  const isPlayingAccent = (accent: EnglishAccent) =>
    Boolean(activeAudio) &&
    activeAudio?.accent === accent &&
    activeAudio?.text === cleaned;

  const playingUs = isPlayingAccent('us');
  const playingUk = isPlayingAccent('uk');
  const suffix = faceLabel ? ` (${faceLabel})` : '';
  const sizeClasses = compact
    ? 'min-h-[32px] lg:min-h-[28px] px-2 sm:px-2.5 py-0.5 rounded-md text-[10px]'
    : 'min-h-[34px] sm:min-h-[40px] lg:min-h-[32px] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px]';

  return (
    <div
      className="inline-flex items-center gap-1.5 shrink-0 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-pressed={playingUs}
        aria-label={`Ouvir frase ${indexLabel} em inglês americano${suffix}`}
        title={`Ouvir frase ${indexLabel} em Inglês Americano (en-US)`}
        onClick={() => {
          void triggerTap();
          void toggleSpeakEnglishText(sentence, 'us', { speed });
        }}
        className={`inline-flex items-center gap-1 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${sizeClasses} ${
          playingUs
            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1D302D] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2]'
        }`}
      >
        {playingUs ? (
          <AudioWaveIcon className={compact ? 'w-3 h-2.5' : 'w-3.5 h-3'} />
        ) : (
          <Volume2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        )}
        <span>US</span>
      </button>

      <button
        type="button"
        aria-pressed={playingUk}
        aria-label={`Ouvir frase ${indexLabel} em inglês britânico${suffix}`}
        title={`Ouvir frase ${indexLabel} em Inglês Britânico (en-GB)`}
        onClick={() => {
          void triggerTap();
          void toggleSpeakEnglishText(sentence, 'uk', { speed });
        }}
        className={`inline-flex items-center gap-1 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${sizeClasses} ${
          playingUk
            ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
            : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6]'
        }`}
      >
        {playingUk ? (
          <AudioWaveIcon className={compact ? 'w-3 h-2.5' : 'w-3.5 h-3'} />
        ) : (
          <Volume2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        )}
        <span>UK</span>
      </button>
    </div>
  );
});
