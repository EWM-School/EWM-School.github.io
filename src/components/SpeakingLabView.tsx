import { memo, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Ear,
  Mic,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { EnglishAccent, Flashcard } from '../types/flashcard';
import { getCardPhonetics } from '../utils/phonetics';
import {
  cleanEnglishForSpeech,
  stopCurrentAudio,
  subscribeAudioPlayback,
  toggleSpeakEnglishText,
  type ActiveAudioPlayback,
} from '../services/platform/speechService';
import { triggerTap } from '../services/platform/hapticsService';
import { AudioWaveIcon } from './CardAudioControls';

interface SpeakingLabViewProps {
  cards: Flashcard[];
  onGoToStudy: () => void;
}

export const SpeakingLabView = memo(function SpeakingLabView({
  cards,
  onGoToStudy,
}: SpeakingLabViewProps) {
  const [targetAccent, setTargetAccent] = useState<EnglishAccent>('us');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(null);

  useEffect(() => {
    const unsub = subscribeAudioPlayback(setActiveAudio);
    return () => {
      unsub();
      stopCurrentAudio();
    };
  }, []);

  const safeIndex = cards.length > 0 ? sampleIndex % cards.length : 0;
  const featuredCard = cards[safeIndex] ?? null;
  const phonetics = featuredCard
    ? getCardPhonetics(featuredCard)
    : { meaning: '', us: '', uk: '', ukNote: null, ukVariantTerm: null };

  const isPlaying = (rawText: string, accent: EnglishAccent) =>
    Boolean(activeAudio) &&
    activeAudio?.accent === accent &&
    activeAudio?.text === cleanEnglishForSpeech(rawText);

  const handleCycleCard = (delta: number) => {
    if (cards.length === 0) return;
    void triggerTap();
    stopCurrentAudio();
    setSampleIndex((prev) => (prev + delta + cards.length) % cards.length);
  };

  return (
    <div className="ewm-pillar-enter space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF3F1] dark:bg-[#172924] border border-[#C6DBD7] dark:border-[#38E5A5]/30 text-[#225851] dark:text-[#38E5A5] text-[11px] font-bold tracking-wide uppercase mb-1">
            <Mic className="w-3 h-3" />
            <span>Speaking Lab · EWM</span>
          </div>
          <h2 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE]">
            Laboratório de Pronúncia Ativa
          </h2>
          <p className="text-xs sm:text-sm text-[#6B655C] dark:text-[#A6AEA8]">
            Ouça o modelo nativo em US ou UK e prepare sua fala com ritmo natural.
          </p>
        </div>

        {/* Target Accent Selector */}
        <div
          role="group"
          aria-label="Escolher sotaque alvo do Speaking Lab"
          className="inline-flex items-center p-1 rounded-2xl border border-[#DFDBD0] dark:border-[#2C342E] bg-[#EAE6DD]/85 dark:bg-[#1A1F1B] self-start sm:self-auto"
        >
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setTargetAccent('us');
            }}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              targetAccent === 'us'
                ? 'bg-white dark:bg-[#27302A] text-[#1C1B18] dark:text-[#38E5A5] shadow-2xs'
                : 'text-[#5C574E] dark:text-[#A0A8A2]'
            }`}
          >
            🇺🇸 Americano (US)
          </button>
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              setTargetAccent('uk');
            }}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              targetAccent === 'uk'
                ? 'bg-white dark:bg-[#27302A] text-[#1C1B18] dark:text-[#8EC5FF] shadow-2xs'
                : 'text-[#5C574E] dark:text-[#A0A8A2]'
            }`}
          >
            🇬🇧 Britânico (UK)
          </button>
        </div>
      </div>

      {/* Main Speaking Stage Card */}
      <section className="rounded-3xl border border-[#DFDAD0] dark:border-[#2C352E] bg-white dark:bg-[#1E231F] p-5 sm:p-8 shadow-xs space-y-6">
        {featuredCard ? (
          <>
            {/* Top Context + Card Cycling */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B655C] dark:text-[#A2AAA4]">
              <span className="font-medium">
                <span className="text-[#28665E] dark:text-[#38E5A5] font-semibold">
                  {featuredCard.category}
                </span>{' '}
                · {featuredCard.subtopic}
              </span>

              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCycleCard(-1)}
                  aria-label="Expressão anterior"
                  className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl border border-[#E4E0D8] dark:border-[#2E3630] bg-[#FAF9F6] dark:bg-[#252B26] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono-num text-[11px] px-2">
                  {safeIndex + 1} / {cards.length}
                </span>
                <button
                  type="button"
                  onClick={() => handleCycleCard(1)}
                  aria-label="Próxima expressão"
                  className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-xl border border-[#E4E0D8] dark:border-[#2E3630] bg-[#FAF9F6] dark:bg-[#252B26] cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Target Expression & Phonetic Guide */}
            <div className="text-center space-y-3 py-2">
              <h3 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#1C1B18] dark:text-[#F4F7F6]">
                {featuredCard.term}
              </h3>

              <p className="font-mono-num text-xs sm:text-sm text-[#225851] dark:text-[#68B4A8]">
                {targetAccent === 'us' ? `US ${phonetics.us}` : `UK ${phonetics.uk}`}
              </p>

              <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#B5BCB6] max-w-xl mx-auto italic">
                &ldquo;{featuredCard.exampleEn}&rdquo;
              </p>

              {/* Native Reference Audio Controls */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    void triggerTap();
                    void toggleSpeakEnglishText(featuredCard.term, targetAccent);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C6DBD7] dark:border-[#38E5A5]/35 bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#192C26] dark:hover:bg-[#203830] text-[#1E4E47] dark:text-[#68B4A8] text-xs font-semibold cursor-pointer"
                >
                  {isPlaying(featuredCard.term, targetAccent) ? (
                    <AudioWaveIcon className="w-3.5 h-3" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>
                    Ouvir Expressão ({targetAccent.toUpperCase()})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void triggerTap();
                    void toggleSpeakEnglishText(featuredCard.exampleEn, targetAccent);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#2F3731] bg-[#FAF9F6] hover:bg-[#F0EDE6] dark:bg-[#252B26] dark:hover:bg-[#2C332D] text-[#524E46] dark:text-[#D4DAD5] text-xs font-semibold cursor-pointer"
                >
                  {isPlaying(featuredCard.exampleEn, targetAccent) ? (
                    <AudioWaveIcon className="w-3.5 h-3" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>Ouvir Frase Completa</span>
                </button>
              </div>
            </div>

            {/* Microphone Capture Stage Ready for Activation */}
            <div className="pt-4 border-t border-[#ECE9E1] dark:border-[#29302A] flex flex-col items-center text-center space-y-3">
              <div
                aria-hidden="true"
                className="ewm-breathing-ring w-16 h-16 rounded-full bg-[#EAF3F1] dark:bg-[#162923] border-2 border-[#28665E] dark:border-[#38E5A5] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center"
              >
                <Mic className="w-7 h-7" />
              </div>

              <div className="space-y-1 max-w-md">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#28665E] dark:text-[#38E5A5]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Estrutura pronta para o Speaking Lab Interativo</span>
                </span>
                <p className="text-xs text-[#6B655C] dark:text-[#9CA59E] leading-relaxed">
                  A captura de microfone com avaliação fonética inteligente e feedback instantâneo de ritmo será conectada diretamente neste palco.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-[#5C574E] dark:text-[#A6AEA8]">
              Selecione expressões na aba Estudo para praticar pronúncia.
            </p>
            <button
              type="button"
              onClick={onGoToStudy}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#28665E] text-white text-xs font-semibold cursor-pointer"
            >
              Ir para Estudo
            </button>
          </div>
        )}
      </section>

      {/* 3 Prepared Capability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2A312B] bg-white/90 dark:bg-[#1C201D] p-4 space-y-1.5">
          <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#182B25] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center">
            <Ear className="w-4 h-4" />
          </div>
          <h4 className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            Shadowing US &amp; UK
          </h4>
          <p className="text-xs text-[#6B655C] dark:text-[#9EA6A0] leading-relaxed">
            Escute e repita expressões reais no sotaque americano ou britânico com cadência guiada.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2A312B] bg-white/90 dark:bg-[#1C201D] p-4 space-y-1.5">
          <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#182B25] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center">
            <AudioLines className="w-4 h-4" />
          </div>
          <h4 className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            Diagnóstico de Pronúncia
          </h4>
          <p className="text-xs text-[#6B655C] dark:text-[#9EA6A0] leading-relaxed">
            Identificação gentil de sílaba tônica, connected speech e sons-chave sem travar sua fluência.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2A312B] bg-white/90 dark:bg-[#1C201D] p-4 space-y-1.5">
          <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#182B25] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            Recompensa em XP Real
          </h4>
          <p className="text-xs text-[#6B655C] dark:text-[#9EA6A0] leading-relaxed">
            Cada prática concluída somará pontos legítimos ao seu progresso mensal e Ranking EWM.
          </p>
        </div>
      </div>
    </div>
  );
});
