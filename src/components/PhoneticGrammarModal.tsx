import { CheckCircle2, Search, ShieldCheck, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAudioPlaybackState } from '../hooks/useAudioPlaybackState';
import { triggerTap } from '../services/platform/hapticsService';
import type { GrammarAuditResult } from '../types/flashcard';
import { auditEnglishGrammarAndCollocations } from '../utils/grammarEngine';
import { stopCurrentAudio, toggleSpeakEnglishText } from '../utils/speech';
import { AudioStatusIcon } from './CardAudioControls';

interface PhoneticGrammarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PHONETIC_RULES = [
  {
    title: '01. Sílaba Tônica & Contrastes de Vocabulário',
    desc: 'A sílaba forte vem sempre em MAIÚSCULAS. Compare reschedule:',
    usCode: 'US /ri-SKÉ-djul/',
    ukCode: 'UK /ri-XÉ-diul/',
    speak: 'Can we reschedule?',
  },
  {
    title: '02. R Americano (Rótico) vs. R Britânico & Linking R',
    desc: 'No UK o R final após vogal silencia (water / card), mas liga antes de vogal (where are):',
    usCode: 'US /UÓ-râr · KÁRD/',
    ukCode: 'UK /UÓ-tâ · KÁAD/',
    speak: 'Where are you? Can I pay by card?',
  },
  {
    title: '03. Flap T Americano vs. T Nítido Britânico',
    desc: 'Nos EUA o T entre vogais soa como R brando; no Reino Unido permanece T claro:',
    usCode: 'US /UÓ-râr · GUÉ-rit/',
    ukCode: 'UK /UÓ-tâ · GUÉT it/',
    speak: "Can I have some water? I don't get it.",
  },
  {
    title: '04. Vogal A Aberta Longa Britânica (/áa/) & Pasta',
    desc: 'Em afternoon e last o UK alonga /áa/, enquanto pasta tem vogal frontal curta:',
    usCode: 'US /éf-târ-NÚN · PÁS-ta/',
    ukCode: 'UK /áaf-tâ-NÚN · PÉS-tâ/',
    speak: "Good afternoon! I'd like the pasta, please.",
  },
  {
    title: '05. Ditongo O (/ôu/ US vs. /êu/ UK)',
    desc: 'Em no, don’t, phone e hold on, o início do ditongo britânico é mais central (/êu/):',
    usCode: 'US /nôu · dôunt · FÔUN/',
    ukCode: 'UK /nêu · dêunt · FÊUN/',
    speak: "Oh no, hold on—don't hang up the phone!",
  },
  {
    title: '06. TH Soprado (TH), H Aspirado (R) & Contrações',
    desc: 'Língua entre os dentes em think /THÍNK/, H suave em hungry /RÂN-gri/ e contrações naturais:',
    usCode: 'US /áil · iór · uír/',
    ukCode: 'UK /áil · ió · uíâ/',
    speak: "I think I'm hungry—I'll call you back!",
  },
];

const SAMPLE_TRAPS = [
  { label: 'Shoes + it (Erro)', sentence: "The shoes fit perfectly—I'll take it!" },
  { label: 'Incontáveis (Erro)', sentence: 'Can you give me an advice and some informations?' },
  { label: 'Preposições (Erro)', sentence: "It depends of the weather and I'm married with her." },
  { label: 'Frase Correta', sentence: "This jacket fits perfectly—I'll take it!" },
];

export function PhoneticGrammarModal({ isOpen, onClose }: PhoneticGrammarModalProps) {
  const { getButtonState } = useAudioPlaybackState();
  const [testInput, setTestInput] = useState('');
  const [auditResult, setAuditResult] = useState<GrammarAuditResult | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCurrentAudio();
    }
    return () => {
      stopCurrentAudio();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const runAudit = (sentence?: string) => {
    const target = typeof sentence === 'string' ? sentence : testInput;
    if (typeof sentence === 'string') setTestInput(sentence);
    setAuditResult(auditEnglishGrammarAndCollocations(target));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phonetic-modal-title"
    >
      <div className="w-full max-w-3xl rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#ECE9E1] dark:border-[#2A2F2A] bg-white/95 dark:bg-[#212421]/95 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="phonetic-modal-title"
                className="font-display text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                Guia Fonético (EWM-US &amp; EWM-UK) &amp; Motor Gramatical
              </h2>
              <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                172 cards auditados nos dois sotaques nativos + 20 regras de concordância e regência
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar guia"
            className="p-2 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Comparative EWM-US & EWM-UK Phonetic Guide */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#28665E] dark:text-[#68B4A8]">
                1. Guia Comparativo de Pronúncia Nativa (Americano US vs. Britânico UK)
              </h3>
              <span className="text-[11px] text-[#857F74] dark:text-[#8A857C]">
                Ouça cada frase nos dois sotaques nativos lado a lado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PHONETIC_RULES.map((rule) => (
                <div
                  key={rule.title}
                  className="rounded-2xl border border-[#ECE9E1] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5 text-xs">
                    <strong className="block text-[#1C1B18] dark:text-[#EBE7DE]">
                      {rule.title}
                    </strong>
                    <p className="text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
                      {rule.desc}
                    </p>
                    <p className="font-mono-num text-[11px] text-[#28665E] dark:text-[#86CEC2] font-semibold pt-0.5">
                      <span>{rule.usCode}</span>
                      <span className="mx-1.5 opacity-60" aria-hidden="true">
                        ·
                      </span>
                      <span>{rule.ukCode}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E4E0D8]/70 dark:border-[#343A34]">
                    <span className="text-[11px] italic text-[#6B655C] dark:text-[#B9B4AA] truncate">
                      &ldquo;{rule.speak}&rdquo;
                    </span>
                    <div className="inline-flex items-center gap-1 shrink-0">
                      {(() => {
                        const usId = `phonetic-rule-${rule.title}-us`;
                        const ukId = `phonetic-rule-${rule.title}-uk`;
                        const usSt = getButtonState({
                          text: rule.speak,
                          accent: 'us',
                          sourceId: usId,
                        });
                        const ukSt = getButtonState({
                          text: rule.speak,
                          accent: 'uk',
                          sourceId: ukId,
                        });
                        return (
                          <>
                            <button
                              type="button"
                              aria-pressed={usSt !== 'idle'}
                              aria-busy={usSt === 'loading'}
                              onClick={(e) => {
                                e.stopPropagation();
                                void triggerTap();
                                void toggleSpeakEnglishText(rule.speak, 'us', {
                                  role: 'sentence',
                                  sourceId: usId,
                                });
                              }}
                              title={`Ouvir em Inglês Americano: ${rule.speak}`}
                              aria-label={`Ouvir em inglês americano: ${rule.speak}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                                usSt === 'loading'
                                  ? 'ewm-audio-loading'
                                  : usSt === 'playing'
                                  ? 'ewm-audio-playing'
                                  : ''
                              } ${
                                usSt !== 'idle'
                                  ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                                  : 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#86CEC2] hover:opacity-85'
                              }`}
                            >
                              <AudioStatusIcon
                                state={usSt}
                                idleClassName="w-3 h-3 shrink-0"
                                activeClassName="w-3 h-2.5"
                              />
                              <span>US</span>
                            </button>
                            <button
                              type="button"
                              aria-pressed={ukSt !== 'idle'}
                              aria-busy={ukSt === 'loading'}
                              onClick={(e) => {
                                e.stopPropagation();
                                void triggerTap();
                                void toggleSpeakEnglishText(rule.speak, 'uk', {
                                  role: 'sentence',
                                  sourceId: ukId,
                                });
                              }}
                              title={`Ouvir em Inglês Britânico: ${rule.speak}`}
                              aria-label={`Ouvir em inglês britânico: ${rule.speak}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                                ukSt === 'loading'
                                  ? 'ewm-audio-loading'
                                  : ukSt === 'playing'
                                  ? 'ewm-audio-playing'
                                  : ''
                              } ${
                                ukSt !== 'idle'
                                  ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
                                  : 'bg-[#EDF1F5] dark:bg-[#1E2630] text-[#243B53] dark:text-[#9CC3E6] hover:opacity-85'
                              }`}
                            >
                              <AudioStatusIcon
                                state={ukSt}
                                idleClassName="w-3 h-3 shrink-0"
                                activeClassName="w-3 h-2.5"
                              />
                              <span>UK</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Live Grammar Tester */}
          <div className="rounded-2xl border border-[#DCE5E2] dark:border-[#2F4B46] bg-[#F4F8F7] dark:bg-[#1B2926] p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[#225851] dark:text-[#86CEC2]">
                2. Testador ao Vivo do Motor Gramatical
              </h3>
              <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0] mt-1">
                O sistema bloqueia frases genéricas e audita regência, incontáveis e concordância
                plural em tempo real.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                aria-label="Frase em inglês para auditar"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runAudit();
                  }
                }}
                placeholder="Ex: The shoes fit perfectly—I'll take it!"
                className="flex-1 px-3.5 py-2 rounded-xl border border-[#D4DFDC] dark:border-[#324D48] bg-white dark:bg-[#212421] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
              />
              <button
                type="button"
                onClick={() => runAudit()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Auditar frase</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0] mr-1">
                Exemplos rápidos:
              </span>
              {SAMPLE_TRAPS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => runAudit(sample.sentence)}
                  className="px-2.5 py-1 rounded-lg border border-[#D4DFDC] dark:border-[#324D48] bg-white dark:bg-[#262A26] text-[11px] font-medium text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E] dark:hover:border-[#68B4A8] cursor-pointer whitespace-nowrap shrink-0"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {auditResult && (
              <div
                className={`rounded-xl p-3 text-xs flex items-start gap-2 font-medium ${
                  auditResult.valid
                    ? 'bg-[#EDF6F1] dark:bg-[#1D3028] text-[#1F4F39] dark:text-[#C5ECDA]'
                    : 'bg-[#FDF2F2] dark:bg-[#311F1E] text-[#8F312B] dark:text-[#F4BCB8]'
                }`}
              >
                {auditResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-mono-num text-[10px] opacity-75 block">
                    {auditResult.ruleCode}
                  </span>
                  <span>{auditResult.reason}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer whitespace-nowrap shrink-0"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
