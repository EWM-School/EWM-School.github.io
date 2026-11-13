import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Globe2,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Search,
  Sparkles,
  Volume2,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isAbortError,
  isLinguisticOfflineError,
  queryLinguisticEngineHybrid,
  type AutoFeedCandidateInput,
} from '../services/linguisticEngineClient';
import { triggerError, triggerSuccess, triggerTap } from '../services/platform/hapticsService';
import {
  getRecentLinguisticHistoryLocal,
  type CachedLinguisticRecord,
} from '../services/sync/offlineStorage';
import type { Flashcard } from '../types/flashcard';
import {
  toCanonicalExpressionKey,
  type ConsultTranslatePayload,
  type DetectedGrammarError,
  type GrammarCheckPayload,
  type LinguisticEngineResult,
} from '../utils/linguisticNormalizer';
import { stopCurrentAudio, toggleSpeakEnglishText } from '../utils/speech';

interface LinguisticLookupModalProps {
  isOpen: boolean;
  allCards: Flashcard[];
  selectedStudyIds: Set<string>;
  onClose: () => void;
  onAddConsultToStudy: (payload: ConsultTranslatePayload) => void;
  onAutoFeedCandidate: (
    candidate: AutoFeedCandidateInput
  ) => { integrated: boolean; bonusXpAwarded: number };
}

type ModeOverride = 'auto' | 'consult' | 'grammar';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const QUICK_EXAMPLES = [
  { label: 'por enquanto', hint: 'PT → EN' },
  { label: 'dar um jeito', hint: 'PT → EN' },
  { label: 'hang up', hint: 'Phrasal Verb' },
  { label: "Let's call it a day and catch up tomorrow.", hint: 'Frase EN' },
  { label: 'I have 25 years', hint: 'Revisão C2' },
];

/**
 * Highlights detected error snippets inside the student's original English sentence.
 */
function renderHighlightedOriginalSentence(
  sentence: string,
  errors: DetectedGrammarError[]
) {
  if (!sentence || errors.length === 0) {
    return <span>{sentence}</span>;
  }

  const snippets = errors
    .map((e) => e.exactSnippet?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0));

  if (snippets.length === 0) {
    return <span>{sentence}</span>;
  }

  const escaped = snippets
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  try {
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = sentence.split(regex);
    return (
      <>
        {parts.map((part, idx) => {
          const isMatch = snippets.some(
            (sn) => sn.toLowerCase() === part.toLowerCase()
          );
          if (isMatch) {
            return (
              <mark
                key={`${part}-${idx}`}
                className="px-1.5 py-0.5 rounded-md bg-[#FDE2E1] dark:bg-[#4A2020] text-[#9E2A25] dark:text-[#FCA5A5] line-through decoration-2 font-semibold"
              >
                {part}
              </mark>
            );
          }
          return <span key={`${part}-${idx}`}>{part}</span>;
        })}
      </>
    );
  } catch {
    return <span>{sentence}</span>;
  }
}

export function LinguisticLookupModal({
  isOpen,
  allCards,
  selectedStudyIds,
  onClose,
  onAddConsultToStudy,
  onAutoFeedCandidate,
}: LinguisticLookupModalProps) {
  const [queryText, setQueryText] = useState('');
  const [modeOverride, setModeOverride] = useState<ModeOverride>('auto');
  const [voiceLang, setVoiceLang] = useState<'pt-BR' | 'en-US'>('pt-BR');
  const [isListening, setIsListening] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LinguisticEngineResult | null>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [shakeVerdict, setShakeVerdict] = useState(false);
  const [addedToStudyKey, setAddedToStudyKey] = useState<string | null>(null);
  const [discoveryBanner, setDiscoveryBanner] = useState<{
    integrated: boolean;
    bonusXp: number;
    animKey: number;
  } | null>(null);
  const [recentHistory, setRecentHistory] = useState<CachedLinguisticRecord[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const speechRecRef = useRef<SpeechRecognitionLike | null>(null);

  const stopVoiceCapture = useCallback(() => {
    try {
      speechRecRef.current?.stop();
    } catch {
      // ignore
    }
    speechRecRef.current = null;
    setIsListening(false);
  }, []);

  const refreshHistory = useCallback(() => {
    void getRecentLinguisticHistoryLocal(5).then(setRecentHistory);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reqIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      stopVoiceCapture();
      stopCurrentAudio();
      setIsLoading(false);
      return;
    }

    refreshHistory();
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 45);
  }, [isOpen, refreshHistory, stopVoiceCapture]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopVoiceCapture();
      stopCurrentAudio();
    };
  }, [stopVoiceCapture]);

  const executeLookup = useCallback(
    async (explicitQuery?: string, explicitMode?: ModeOverride) => {
      const targetQuery = (explicitQuery ?? queryText).trim();
      const targetMode = explicitMode ?? modeOverride;
      if (!targetQuery) {
        inputRef.current?.focus();
        return;
      }

      void triggerTap();
      stopVoiceCapture();
      stopCurrentAudio();

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const reqId = ++reqIdRef.current;

      setIsLoading(true);
      setOfflineError(null);
      setShakeVerdict(false);
      setDiscoveryBanner(null);

      try {
        const res = await queryLinguisticEngineHybrid({
          query: targetQuery,
          modeOverride: targetMode,
          localCards: allCards,
          signal: controller.signal,
        });

        if (reqId !== reqIdRef.current || controller.signal.aborted) {
          return;
        }

        setResult(res);
        setAddedToStudyKey(null);
        refreshHistory();

        if (res.mode === 'GRAMMAR_CHECK') {
          if (res.verdict === 'INCORRECT') {
            void triggerError();
            setShakeVerdict(false);
            window.requestAnimationFrame(() => {
              setShakeVerdict(true);
              window.setTimeout(() => setShakeVerdict(false), 260);
            });
          } else {
            void triggerSuccess();
          }
        } else {
          void triggerSuccess();
          // Trigger Automatic School Catalog Curatorship & Anti-Farming Discovery Bonus
          if (res.isValidForGlobalSchoolDeck && res.examples[0]?.en && res.examples[0]?.pt) {
            const ex1 = res.examples[0];
            const ex2 = res.examples[1] || res.examples[0];
            const feedOutcome = onAutoFeedCandidate({
              englishExpression: res.englishExpression,
              primaryTranslation: res.primaryTranslation,
              category: res.suggestedCategory,
              subtopic: res.suggestedSubtopic,
              phoneticUs: res.phoneticUs,
              phoneticUk: res.phoneticUk,
              ukNote: res.usUkDifferences,
              colloquial: res.colloquialPtList,
              exampleEn: ex1.en,
              examplePt: ex1.pt,
              exampleEn2: ex2.en,
              examplePt2: ex2.pt,
              tip: res.pedagogicalTip || res.falseCognateOrLiteralWarning,
              isValidForGlobalSchoolDeck: res.isValidForGlobalSchoolDeck,
            });

            if (feedOutcome.integrated) {
              setDiscoveryBanner({
                integrated: true,
                bonusXp: feedOutcome.bonusXpAwarded,
                animKey: Date.now(),
              });
            }
          }
        }
      } catch (err) {
        if (isAbortError(err) || reqId !== reqIdRef.current) {
          return;
        }
        if (isLinguisticOfflineError(err)) {
          setOfflineError(err.message);
        } else {
          setOfflineError(
            'Não foi possível concluir a análise neste instante. Verifique sua conexão e tente novamente.'
          );
        }
      } finally {
        if (reqId === reqIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [allCards, modeOverride, onAutoFeedCandidate, queryText, refreshHistory, stopVoiceCapture]
  );

  const handleToggleVoiceInput = () => {
    if (isListening) {
      stopVoiceCapture();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecCtor) {
      setOfflineError(
        'Entrada por voz não disponível neste navegador. Digite a expressão ou frase no campo acima.'
      );
      return;
    }

    try {
      void triggerTap();
      const rec = new SpeechRecCtor();
      rec.lang = voiceLang;
      rec.interimResults = true;
      rec.continuous = false;

      let latestTranscript = '';
      rec.onresult = (ev) => {
        let combined = '';
        for (let i = 0; i < ev.results.length; i++) {
          combined += ev.results[i][0]?.transcript || '';
        }
        latestTranscript = combined.trim();
        if (latestTranscript) {
          setQueryText(latestTranscript);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        if (latestTranscript.trim()) {
          void executeLookup(latestTranscript.trim());
        }
      };

      speechRecRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const alreadyInStudy = useMemo(() => {
    if (!result || result.mode !== 'CONSULT_TRANSLATE') return false;
    const ck = toCanonicalExpressionKey(result.englishExpression);
    if (addedToStudyKey === ck) return true;
    const matched = allCards.find((c) => toCanonicalExpressionKey(c.term) === ck);
    return matched ? selectedStudyIds.has(matched.id) : false;
  }, [addedToStudyKey, allCards, result, selectedStudyIds]);

  if (!isOpen) return null;

  const cacheBadgeLabel =
    result?.cacheLayer === 'L1_INDEXEDDB'
      ? 'Instantâneo · Cache Local (0ms)'
      : result?.cacheLayer === 'L2_FIRESTORE'
      ? 'Cache Coletivo EWM'
      : result?.cacheLayer === 'L1_OFFLINE_LEXICON'
      ? 'Acervo Local Offline'
      : result?.cacheLayer === 'L3_GEMINI'
      ? 'Análise Determinística C2'
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="linguistic-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full sm:max-w-2xl rounded-b-3xl sm:rounded-3xl border border-[#E4E0D8] dark:border-[#2C342E] bg-[#FCFBF8] dark:bg-[#191D1A] shadow-2xl overflow-hidden sm:my-auto max-h-[95dvh] flex flex-col ewm-pillar-enter">
        {/* Top Command Header */}
        <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-[#ECE8DF] dark:border-[#272E28] bg-white dark:bg-[#1E231F] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-[#EAF3F1] dark:bg-[#172C25] text-[#28665E] dark:text-[#38E5A5] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2
                id="linguistic-modal-title"
                className="font-display font-bold text-sm sm:text-base text-[#1C1B18] dark:text-[#F3F0E8] truncate"
              >
                Consultor Contextual & Examinador C2
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar consulta"
              className="p-1.5 rounded-xl text-[#6B655C] dark:text-[#9CA39E] hover:bg-[#ECE8DF] dark:hover:bg-[#29302B] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Protagonist Single Unified Input (Text + Voice PT/EN) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void executeLookup();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1 min-w-0 flex items-center">
              <Search className="w-4 h-4 text-[#7C766C] dark:text-[#88918B] absolute left-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  if (offlineError) setOfflineError(null);
                }}
                placeholder="Digite expressão (PT ou EN) ou frase em inglês para revisar..."
                className="w-full pl-10 pr-20 py-3 rounded-2xl border border-[#D8D3C8] dark:border-[#323B35] bg-[#FAF9F6] dark:bg-[#151916] text-sm sm:text-[15px] text-[#1C1B18] dark:text-[#F4F2EC] placeholder:text-[#8C857B] dark:placeholder:text-[#7A827C] focus:outline-none focus:border-[#38E5A5] focus:ring-2 focus:ring-[#38E5A5]/20"
              />

              {/* Voice Language Toggle + Mic Button */}
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setVoiceLang((prev) => (prev === 'pt-BR' ? 'en-US' : 'pt-BR'))
                  }
                  title="Alternar idioma do microfone (PT-BR / EN-US)"
                  className="px-1.5 py-1 rounded-lg text-[10px] font-bold text-[#6B655C] dark:text-[#9CA39E] hover:bg-[#EAE6DD] dark:hover:bg-[#262C28] cursor-pointer"
                >
                  {voiceLang === 'pt-BR' ? 'PT' : 'EN'}
                </button>
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  title={isListening ? 'Parar gravação' : 'Falar por voz'}
                  aria-label={isListening ? 'Parar gravação de voz' : 'Iniciar entrada por voz'}
                  className={`p-1.5 rounded-xl cursor-pointer ${
                    isListening
                      ? 'bg-[#38E5A5] text-[#0B1F17] ewm-breathing-ring'
                      : 'text-[#5C574E] dark:text-[#A4ABA6] hover:bg-[#EAE6DD] dark:hover:bg-[#262C28]'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !queryText.trim()}
              className="px-4 sm:px-5 py-3 rounded-2xl bg-[#38E5A5] hover:bg-[#2FD497] disabled:opacity-45 text-[#0B1F17] font-bold text-xs sm:text-sm cursor-pointer shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Consultar'}
            </button>
          </form>

          {/* Subtle Intent Override Chips + Cache Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1">
              {(
                [
                  { id: 'auto', label: 'Automático' },
                  { id: 'consult', label: 'Tradutor Contextual' },
                  { id: 'grammar', label: 'Examinador Gramatical' },
                ] as const
              ).map((opt) => {
                const active = modeOverride === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setModeOverride(opt.id);
                      if (queryText.trim()) {
                        void executeLookup(queryText, opt.id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                      active
                        ? 'bg-[#1E4E47] dark:bg-[#38E5A5]/18 text-white dark:text-[#38E5A5]'
                        : 'text-[#6B655C] dark:text-[#9CA39E] hover:bg-[#ECE8DF] dark:hover:bg-[#262C28]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {cacheBadgeLabel && !isLoading && (
              <span className="text-[10.5px] font-mono-num text-[#6B655C] dark:text-[#959E98]">
                {cacheBadgeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Body Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Loading Skeleton */}
          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-[#E4E0D8] dark:border-[#2C332E] bg-white dark:bg-[#1F2420] p-5 space-y-3 animate-pulse"
            >
              <div className="h-5 w-48 rounded-lg bg-[#E6E2D8] dark:bg-[#2C332E]" />
              <div className="h-4 w-3/4 rounded-lg bg-[#EFECE4] dark:bg-[#262C28]" />
              <div className="h-20 w-full rounded-xl bg-[#F4F1EA] dark:bg-[#222824]" />
            </div>
          )}

          {/* Honest Offline Reconnection State */}
          {!isLoading && offlineError && (
            <div className="rounded-2xl border border-[#E6CFC8] dark:border-[#4B2E2B] bg-[#FDF6F4] dark:bg-[#291C1B] p-4 space-y-3 ewm-pillar-enter">
              <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#8C332B] dark:text-[#F3B7B1]">
                <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{offlineError}</p>
              </div>
              <div className="pl-6">
                <button
                  type="button"
                  onClick={() => void executeLookup()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#8C332B] text-white text-xs font-semibold cursor-pointer"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Idle State: Quick Try Chips + Recent Local L1 History */}
          {!isLoading && !offlineError && !result && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B655C] dark:text-[#969F99]">
                  Experimente consultar ou verificar
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_EXAMPLES.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setQueryText(item.label);
                        void executeLookup(item.label);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DFDBD0] dark:border-[#2E3630] bg-white dark:bg-[#212622] hover:border-[#38E5A5] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F0EDE6] dark:bg-[#2B322D] text-[#6B655C] dark:text-[#9CA39E]">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {recentHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#ECE8DF] dark:border-[#262C28]">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6B655C] dark:text-[#969F99]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Consultas recentes neste aparelho (0ms Offline)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentHistory.map((item) => {
                      const label =
                        item.result.mode === 'CONSULT_TRANSLATE'
                          ? item.result.query || item.result.englishExpression
                          : item.result.originalSentence;
                      return (
                        <button
                          key={item.cacheKey}
                          type="button"
                          onClick={() => {
                            const nextMode: ModeOverride =
                              item.mode === 'GRAMMAR_CHECK' ? 'grammar' : 'consult';
                            setModeOverride(nextMode);
                            setQueryText(label);
                            void executeLookup(label, nextMode);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#2C332E] bg-[#FAF9F6] dark:bg-[#1E231F] text-xs text-[#5C574E] dark:text-[#B9C0BB] hover:border-[#38E5A5] truncate max-w-[260px] cursor-pointer"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              MODO 1: CONSULTOR & TRADUTOR CONTEXTUAL
              ================================================================= */}
          {!isLoading && result && result.mode === 'CONSULT_TRANSLATE' && (
            <ConsultTranslateView
              data={result}
              discoveryBanner={discoveryBanner}
              alreadyInStudy={alreadyInStudy}
              onAddToStudy={() => {
                void triggerTap();
                onAddConsultToStudy(result);
                setAddedToStudyKey(toCanonicalExpressionKey(result.englishExpression));
              }}
            />
          )}

          {/* =================================================================
              MODO 2: EXAMINADOR GRAMATICAL RIGOROSO C2
              ================================================================= */}
          {!isLoading && result && result.mode === 'GRAMMAR_CHECK' && (
            <GrammarExaminerView data={result} shakeVerdict={shakeVerdict} />
          )}
        </div>
      </div>
    </div>
  );
}

function ConsultTranslateView({
  data,
  discoveryBanner,
  alreadyInStudy,
  onAddToStudy,
}: {
  data: ConsultTranslatePayload;
  discoveryBanner: { integrated: boolean; bonusXp: number; animKey: number } | null;
  alreadyInStudy: boolean;
  onAddToStudy: () => void;
}) {
  return (
    <div className="space-y-4 ewm-pillar-enter">
      {/* Discreet Auto-Feed Global Discovery Notice + Floating +2 XP */}
      {discoveryBanner?.integrated && (
        <div className="relative rounded-2xl border border-[#BCE3D4] dark:border-[#38E5A5]/35 bg-[#EEF9F4] dark:bg-[#152922] px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#175045] dark:text-[#6EE7B7]">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#22C58B] shrink-0" />
            <span>
              {discoveryBanner.bonusXp > 0
                ? `✨ Nova expressão integrada ao Acervo EWM (+${discoveryBanner.bonusXp} XP)`
                : '✨ Nova expressão integrada automaticamente ao Acervo Completo EWM'}
            </span>
          </span>
          {discoveryBanner.bonusXp > 0 && (
            <span
              key={discoveryBanner.animKey}
              className="ewm-float-xp font-mono-num font-extrabold text-[#16A36A] dark:text-[#38E5A5] shrink-0"
            >
              +{discoveryBanner.bonusXp} XP
            </span>
          )}
        </div>
      )}

      {/* Primary Expression & Meaning Card */}
      <div className="rounded-2xl border border-[#DFDBD0] dark:border-[#2E3630] bg-white dark:bg-[#202521] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="inline-block text-[10.5px] font-bold uppercase tracking-wider text-[#28665E] dark:text-[#38E5A5]">
              Equivalente Idiomático Principal
            </span>
            <h3 className="font-display font-bold text-xl sm:text-2xl text-[#1C1B18] dark:text-[#F5F2EA]">
              {data.englishExpression}
            </h3>
            <p className="text-sm sm:text-base font-medium text-[#4A463E] dark:text-[#CFD5D0]">
              {data.primaryTranslation}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void toggleSpeakEnglishText(data.englishExpression, 'us')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CDE0DC] dark:border-[#38E5A5]/30 bg-[#F2F9F7] dark:bg-[#172A24] text-xs font-bold text-[#1E524A] dark:text-[#38E5A5] cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>US</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleSpeakEnglishText(data.englishExpression, 'uk')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CBD9E6] dark:border-[#38526B] bg-[#F2F6FA] dark:bg-[#192530] text-xs font-bold text-[#244B6B] dark:text-[#8CC2F0] cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>UK</span>
            </button>
          </div>
        </div>

        {(data.phoneticUs || data.phoneticUk) && (
          <p className="font-mono-num text-xs text-[#6B655C] dark:text-[#9CA39E]">
            {data.phoneticUs ? `US ${data.phoneticUs}` : ''}
            {data.phoneticUs && data.phoneticUk ? '  ·  ' : ''}
            {data.phoneticUk ? `UK ${data.phoneticUk}` : ''}
          </p>
        )}

        {data.usUkDifferences && (
          <div className="pt-2 border-t border-[#ECE8DF] dark:border-[#2B332D] flex items-start gap-2 text-xs text-[#5C574E] dark:text-[#B4BBB5]">
            <Globe2 className="w-3.5 h-3.5 text-[#28665E] dark:text-[#38E5A5] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">US vs UK:</strong>{' '}
              {data.usUkDifferences}
            </span>
          </div>
        )}
      </div>

      {/* Anti-Portuglês / False Cognate Warning */}
      {data.falseCognateOrLiteralWarning && (
        <div className="rounded-2xl border border-[#EAD5AE] dark:border-[#4D3D1F] bg-[#FFFBEB] dark:bg-[#262013] px-4 py-3 flex items-start gap-2.5 text-xs text-[#8A5309] dark:text-[#FCD34D]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Atenção contra tradução literal: </strong>
            <span>{data.falseCognateOrLiteralWarning}</span>
          </div>
        </div>
      )}

      {/* Semantic Disambiguation (Contextual Nuances) */}
      {data.contextualNuances.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#9FA7A1]">
            Nuances & Quando Usar Cada Variação
          </h4>
          <div className="grid grid-cols-1 gap-2.5">
            {data.contextualNuances.map((nuance, idx) => (
              <div
                key={`${nuance.expressionEn}-${idx}`}
                className="rounded-2xl border border-[#E4E0D8] dark:border-[#2D352F] bg-[#FAF9F6] dark:bg-[#1D221E] p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm text-[#1C1B18] dark:text-[#F3F0E8]">
                      {nuance.expressionEn}
                    </span>
                    <span className="text-xs font-semibold text-[#28665E] dark:text-[#38E5A5]">
                      — {nuance.meaningPt}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleSpeakEnglishText(nuance.expressionEn, 'us')}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#28665E] dark:text-[#38E5A5] hover:bg-[#EAF3F1] dark:hover:bg-[#172A24] cursor-pointer"
                    >
                      US
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleSpeakEnglishText(nuance.expressionEn, 'uk')}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#244B6B] dark:text-[#8CC2F0] hover:bg-[#EDF3F8] dark:hover:bg-[#1B2834] cursor-pointer"
                    >
                      UK
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#5C574E] dark:text-[#B4BBB5] leading-relaxed">
                  {nuance.whenToUsePt}
                </p>
                {nuance.exampleEn && (
                  <p className="text-xs italic text-[#3F3B34] dark:text-[#D5DBD6] pt-0.5">
                    “{nuance.exampleEn}”{' '}
                    {nuance.examplePt ? (
                      <span className="not-italic text-[#6B655C] dark:text-[#9CA39E]">
                        ({nuance.examplePt})
                      </span>
                    ) : null}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2 Authentic Examples (EN + PT with US/UK Audio) */}
      {data.examples.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#9FA7A1]">
            Exemplos Reais com Áudio US & UK
          </h4>
          <div className="space-y-2">
            {data.examples.slice(0, 2).map((ex, idx) => (
              <div
                key={`${ex.en}-${idx}`}
                className="rounded-2xl border border-[#E4E0D8] dark:border-[#2D352F] bg-white dark:bg-[#202521] p-3.5 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-[#1C1B18] dark:text-[#F3F0E8]">
                    {ex.en}
                  </p>
                  <p className="text-xs text-[#6B655C] dark:text-[#A5ADA7]">{ex.pt}</p>
                </div>
                <div className="inline-flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleSpeakEnglishText(ex.en, 'us')}
                    title="Ouvir exemplo em inglês americano"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D8D3C8] dark:border-[#323A34] text-[10px] font-bold text-[#28665E] dark:text-[#38E5A5] cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>US</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleSpeakEnglishText(ex.en, 'uk')}
                    title="Ouvir exemplo em inglês britânico"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D8D3C8] dark:border-[#323A34] text-[10px] font-bold text-[#244B6B] dark:text-[#8CC2F0] cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>UK</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1-Click Quick Action Footer */}
      <div className="pt-2 border-t border-[#ECE8DF] dark:border-[#282E29] flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#6B655C] dark:text-[#969F99]">
          Pasta sugerida: <strong>{data.suggestedCategory}</strong> · {data.suggestedSubtopic}
        </span>

        <button
          type="button"
          disabled={alreadyInStudy}
          onClick={onAddToStudy}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer shrink-0 ${
            alreadyInStudy
              ? 'bg-[#EAF3F1] dark:bg-[#1B3029] text-[#1F564E] dark:text-[#38E5A5] cursor-default'
              : 'bg-[#38E5A5] hover:bg-[#2FD497] text-[#0B1F17] shadow-sm'
          }`}
        >
          {alreadyInStudy ? (
            <>
              <Check className="w-4 h-4" />
              <span>Adicionado ao meu estudo</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>+ Adicionar ao meu estudo</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function GrammarExaminerView({
  data,
  shakeVerdict,
}: {
  data: GrammarCheckPayload;
  shakeVerdict: boolean;
}) {
  const verdictMeta =
    data.verdict === 'PERFECT_NATURAL'
      ? {
          badge: '🟢 Perfeita e Natural',
          subtitle: 'Zero erros gramaticais e 100% idiomática para falantes nativos.',
          boxClass:
            'border-[#B8E2D0] dark:border-[#295946] bg-[#EFFAF4] dark:bg-[#142820] text-[#145339] dark:text-[#7CECC2]',
          icon: CheckCircle2,
        }
      : data.verdict === 'UNDERSTANDABLE_UNNATURAL'
      ? {
          badge: '🟡 Compreensível, mas Pouco Natural',
          subtitle:
            data.unnaturalnessNotePt ||
            'Compreensível, mas um falante nativo formularia de modo mais fluido.',
          boxClass:
            'border-[#EAD29E] dark:border-[#57431B] bg-[#FFFBEB] dark:bg-[#272012] text-[#854D0E] dark:text-[#FDE047]',
          icon: AlertTriangle,
        }
      : {
          badge: '🔴 Incorreta — Precisa de Ajuste',
          subtitle:
            'Encontramos ponto(s) gramaticais ou de naturalidade que precisam de correção.',
          boxClass:
            'border-[#EBBFBC] dark:border-[#572624] bg-[#FEF2F2] dark:bg-[#291717] text-[#991B1B] dark:text-[#FCA5A5]',
          icon: XCircle,
        };

  const VerdictIcon = verdictMeta.icon;

  return (
    <div
      className={`space-y-4 ewm-pillar-enter ${shakeVerdict ? 'ewm-micro-shake' : ''}`}
    >
      {/* Visual Verdict Banner */}
      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${verdictMeta.boxClass}`}>
        <VerdictIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <h3 className="font-display font-bold text-sm sm:text-base">{verdictMeta.badge}</h3>
          <p className="text-xs sm:text-[13px] opacity-90 leading-relaxed">
            {verdictMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Highlighted Original Input (when Incorrect or Unnatural) */}
      {data.verdict !== 'PERFECT_NATURAL' && (
        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2D352F] bg-[#FAF9F6] dark:bg-[#1C201D] p-4 space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B655C] dark:text-[#969F99]">
            Frase analisada
          </span>
          <p className="text-sm sm:text-base text-[#1C1B18] dark:text-[#EBE7DE] leading-relaxed">
            {renderHighlightedOriginalSentence(data.originalSentence, data.detectedErrors)}
          </p>
        </div>
      )}

      {/* Natural / Corrected Native Version + US & UK Audio */}
      <div className="rounded-2xl border border-[#C6DBD7] dark:border-[#2E4B44] bg-white dark:bg-[#1E2622] p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#1F564E] dark:text-[#38E5A5]">
              {data.verdict === 'PERFECT_NATURAL'
                ? 'Sua frase validada'
                : data.verdict === 'UNDERSTANDABLE_UNNATURAL'
                ? 'Como um nativo diria naturalmente'
                : 'Forma correta e natural'}
            </span>
            <p className="font-display font-bold text-base sm:text-lg text-[#1C1B18] dark:text-[#F5F2EA]">
              {data.correctedNaturalSentence}
            </p>
            {data.correctedTranslationPt && (
              <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#B4BBB5]">
                {data.correctedTranslationPt}
              </p>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void toggleSpeakEnglishText(data.correctedNaturalSentence, 'us')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#CDE0DC] dark:border-[#38E5A5]/30 bg-[#F2F9F7] dark:bg-[#172A24] text-xs font-bold text-[#1E524A] dark:text-[#38E5A5] cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>US</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleSpeakEnglishText(data.correctedNaturalSentence, 'uk')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#CBD9E6] dark:border-[#38526B] bg-[#F2F6FA] dark:bg-[#192530] text-xs font-bold text-[#244B6B] dark:text-[#8CC2F0] cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>UK</span>
            </button>
          </div>
        </div>

        {data.alternativeNaturalSentence &&
          data.alternativeNaturalSentence.toLowerCase() !==
            data.correctedNaturalSentence.toLowerCase() && (
            <div className="pt-2 border-t border-[#ECE8DF] dark:border-[#2B352F] flex items-center justify-between gap-2 text-xs">
              <span className="text-[#5C574E] dark:text-[#B4BBB5]">
                <strong>Outra opção nativa:</strong> “{data.alternativeNaturalSentence}”
              </span>
              <div className="inline-flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void toggleSpeakEnglishText(data.alternativeNaturalSentence!, 'us')
                  }
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#28665E] dark:text-[#38E5A5] cursor-pointer"
                >
                  US
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void toggleSpeakEnglishText(data.alternativeNaturalSentence!, 'uk')
                  }
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#244B6B] dark:text-[#8CC2F0] cursor-pointer"
                >
                  UK
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Concise 1-Line PT-BR Explanations per Detected Error */}
      {data.detectedErrors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#9FA7A1]">
            Ajustes Explicados de Forma Direta
          </h4>
          <div className="space-y-2">
            {data.detectedErrors.map((err, idx) => (
              <div
                key={`${err.exactSnippet}-${idx}`}
                className="rounded-2xl border border-[#E6CFC8] dark:border-[#462927] bg-white dark:bg-[#221A1A] p-3.5 space-y-1"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {err.exactSnippet && (
                    <span className="px-2 py-0.5 rounded-md bg-[#FDE2E1] dark:bg-[#4A2020] text-[#9E2A25] dark:text-[#FCA5A5] line-through font-semibold">
                      {err.exactSnippet}
                    </span>
                  )}
                  {err.replacementSnippet && (
                    <>
                      <span className="text-[#6B655C] dark:text-[#9CA39E]">→</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#E6F7EF] dark:bg-[#183529] text-[#155E42] dark:text-[#6EE7B7] font-bold">
                        {err.replacementSnippet}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#3F3B34] dark:text-[#DCE1DD] leading-relaxed">
                  {err.explanationPt}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
