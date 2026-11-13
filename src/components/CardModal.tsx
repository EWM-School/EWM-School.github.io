import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Folder,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VALID_FOLDERS, VALID_SUBTOPICS } from '../data/seedData';
import type { AutoFeedCandidateInput } from '../services/linguisticEngineClient';
import { triggerTap } from '../services/platform/hapticsService';
import type { Flashcard, SubtopicKey, TopicFolder } from '../types/flashcard';
import {
  generateNewExampleSentence,
  isAbortError,
  isLinguisticOfflineError,
  lookupSmartCardContent,
} from '../utils/aiLookup';
import {
  classifyCardSubtopic,
  classifyTermIntoFolder,
  getCardSecondExample,
} from '../utils/deckHelpers';
import {
  formatCleanExampleSentence,
  toCanonicalExpressionKey,
} from '../utils/linguisticNormalizer';
import {
  getCardPhonetics,
  synthesizeOfflinePhrasePhonetics,
} from '../utils/phonetics';
import { stopCurrentAudio, toggleSpeakEnglishText } from '../utils/speech';

interface CardModalProps {
  isOpen: boolean;
  editingCard: Flashcard | null;
  allCards: Flashcard[];
  contextTitle?: string;
  contextSubtitle?: string;
  onClose: () => void;
  onSave: (cardData: Omit<Flashcard, 'id' | 'status'>, existingId?: string) => void;
  onSelectExistingCard?: (card: Flashcard) => void;
  onAutoFeedCandidate?: (candidate: AutoFeedCandidateInput) => void;
}

type ModalStage = 'magic_input' | 'review_form';

export function CardModal({
  isOpen,
  editingCard,
  allCards,
  contextTitle,
  contextSubtitle,
  onClose,
  onSave,
  onSelectExistingCard,
  onAutoFeedCandidate,
}: CardModalProps) {
  const [stage, setStage] = useState<ModalStage>(editingCard ? 'review_form' : 'magic_input');
  const [magicQuery, setMagicQuery] = useState('');

  // Core Card Fields (Stage 2)
  const [term, setTerm] = useState('');
  const [literal, setLiteral] = useState('');
  const [exampleEn, setExampleEn] = useState('');
  const [examplePt, setExamplePt] = useState('');
  const [exampleEn2, setExampleEn2] = useState('');
  const [examplePt2, setExamplePt2] = useState('');
  const [category, setCategory] = useState<TopicFolder>('Frases');
  const [subtopic, setSubtopic] = useState<SubtopicKey>('Casual');
  const [phoneticUs, setPhoneticUs] = useState('');
  const [phoneticUk, setPhoneticUk] = useState('');
  const [ukNote, setUkNote] = useState('');
  const [colloquialList, setColloquialList] = useState<string[]>([]);
  const [tip, setTip] = useState('');
  const [isEditingTip, setIsEditingTip] = useState(false);

  // Async & Feedback States
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatusText, setLookupStatusText] = useState('');
  const [isRegeneratingExample, setIsRegeneratingExample] = useState(false);
  const [seenExamplesHistory, setSeenExamplesHistory] = useState<string[]>([]);
  const [offlineErrorMsg, setOfflineErrorMsg] = useState<string | null>(null);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);

  // Race-condition protection refs (`AbortController` + monotonic request IDs)
  const lookupAbortRef = useRef<AbortController | null>(null);
  const lookupReqIdRef = useRef(0);
  const exampleAbortRef = useRef<AbortController | null>(null);
  const exampleReqIdRef = useRef(0);
  const magicInputRef = useRef<HTMLInputElement | null>(null);

  const cancelInFlightRequests = useCallback(() => {
    lookupReqIdRef.current += 1;
    exampleReqIdRef.current += 1;
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    exampleAbortRef.current?.abort();
    exampleAbortRef.current = null;
    setIsLookingUp(false);
    setIsRegeneratingExample(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cancelInFlightRequests();
      stopCurrentAudio();
      return;
    }

    cancelInFlightRequests();
    setOfflineErrorMsg(null);
    setFormErrorMsg(null);
    setShakeError(false);

    if (editingCard) {
      const phon = getCardPhonetics(editingCard);
      const sec = getCardSecondExample(editingCard);
      setStage('review_form');
      setMagicQuery(editingCard.term);
      setTerm(editingCard.term);
      setLiteral(phon.meaning || editingCard.literal);
      setExampleEn(editingCard.exampleEn);
      setExamplePt(editingCard.examplePt);
      setExampleEn2(sec.en || editingCard.exampleEn);
      setExamplePt2(sec.pt || editingCard.examplePt);
      setCategory(editingCard.category);
      setSubtopic(editingCard.subtopic || 'Casual');
      setPhoneticUs(editingCard.phoneticUs || phon.us || '');
      setPhoneticUk(editingCard.phoneticUk || phon.uk || '');
      setUkNote(editingCard.ukNote || phon.ukNote || '');
      setColloquialList(editingCard.colloquial || []);
      setTip(editingCard.tip || '');
      setIsEditingTip(false);
      setSeenExamplesHistory(
        [editingCard.exampleEn, sec.en].filter((x): x is string => Boolean(x))
      );
    } else {
      setStage('magic_input');
      setMagicQuery('');
      setTerm('');
      setLiteral('');
      setExampleEn('');
      setExamplePt('');
      setExampleEn2('');
      setExamplePt2('');
      setCategory('Frases');
      setSubtopic('Casual');
      setPhoneticUs('');
      setPhoneticUk('');
      setUkNote('');
      setColloquialList([]);
      setTip('');
      setIsEditingTip(false);
      setSeenExamplesHistory([]);
      window.setTimeout(() => {
        magicInputRef.current?.focus();
      }, 40);
    }
  }, [isOpen, editingCard, cancelInFlightRequests]);

  useEffect(() => {
    return () => {
      cancelInFlightRequests();
      stopCurrentAudio();
    };
  }, [cancelInFlightRequests]);

  // 0ms Instant Canonical Anti-Duplicate Detection
  const duplicateCard = useMemo(() => {
    const raw = stage === 'magic_input' ? magicQuery : term;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) return null;

    const canonical = toCanonicalExpressionKey(trimmed);
    const lowerRaw = trimmed.toLowerCase();

    return (
      allCards.find((c) => {
        if (editingCard && c.id === editingCard.id) return false;
        if (canonical && toCanonicalExpressionKey(c.term) === canonical) return true;
        if (c.literal.toLowerCase().trim() === lowerRaw) return true;
        return false;
      }) ?? null
    );
  }, [allCards, editingCard, magicQuery, stage, term]);

  const triggerSubtleShake = useCallback(() => {
    setShakeError(false);
    window.requestAnimationFrame(() => {
      setShakeError(true);
      window.setTimeout(() => setShakeError(false), 260);
    });
  }, []);

  const handleOpenExistingDuplicate = (existing: Flashcard) => {
    void triggerTap();
    cancelInFlightRequests();
    if (onSelectExistingCard) {
      onSelectExistingCard(existing);
      return;
    }
    const phon = getCardPhonetics(existing);
    const sec = getCardSecondExample(existing);
    setTerm(existing.term);
    setLiteral(phon.meaning || existing.literal);
    setExampleEn(existing.exampleEn);
    setExamplePt(existing.examplePt);
    setExampleEn2(sec.en || existing.exampleEn);
    setExamplePt2(sec.pt || existing.examplePt);
    setCategory(existing.category);
    setSubtopic(existing.subtopic || 'Casual');
    setPhoneticUs(existing.phoneticUs || phon.us || '');
    setPhoneticUk(existing.phoneticUk || phon.uk || '');
    setUkNote(existing.ukNote || phon.ukNote || '');
    setColloquialList(existing.colloquial || []);
    setTip(existing.tip || '');
    setSeenExamplesHistory([existing.exampleEn, sec.en].filter(Boolean));
    setStage('review_form');
  };

  const handleMagicAiAutofill = async () => {
    const query = magicQuery.trim();
    if (!query) {
      setFormErrorMsg('Digite uma palavra ou expressão para preencher com IA.');
      triggerSubtleShake();
      magicInputRef.current?.focus();
      return;
    }

    void triggerTap();
    setFormErrorMsg(null);
    setOfflineErrorMsg(null);

    // Cancel any previous lookup or sentence generation
    lookupAbortRef.current?.abort();
    exampleAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    const reqId = ++lookupReqIdRef.current;

    setIsLookingUp(true);
    setLookupStatusText('Consultando significado idiomático e contexto nativo...');

    try {
      const result = await lookupSmartCardContent(
        query,
        'auto',
        allCards,
        (_st, msg) => {
          if (reqId === lookupReqIdRef.current) {
            setLookupStatusText(msg);
          }
        },
        { signal: controller.signal }
      );

      if (reqId !== lookupReqIdRef.current || controller.signal.aborted) {
        return;
      }

      if (!result) {
        setFormErrorMsg('Não foi possível identificar essa expressão. Tente reformular.');
        triggerSubtleShake();
        return;
      }

      setTerm(result.term);
      setLiteral(result.literal);
      setExampleEn(result.exampleEn);
      setExamplePt(result.examplePt);
      setExampleEn2(result.exampleEn2 || result.exampleEn);
      setExamplePt2(result.examplePt2 || result.examplePt);
      setCategory(result.category);
      setSubtopic(result.subtopic);
      setPhoneticUs(result.phoneticUs || '');
      setPhoneticUk(result.phoneticUk || '');
      setUkNote(result.ukNote || '');
      setColloquialList(result.colloquial.length > 0 ? result.colloquial : [result.literal]);
      setTip(result.tip || '');
      setIsEditingTip(false);
      setSeenExamplesHistory(
        [result.exampleEn, result.exampleEn2].filter((x): x is string => Boolean(x))
      );
      setStage('review_form');

      if (result.isValidForGlobalSchoolDeck && onAutoFeedCandidate) {
        onAutoFeedCandidate({
          englishExpression: result.term,
          primaryTranslation: result.literal,
          category: result.category,
          subtopic: result.subtopic,
          phoneticUs: result.phoneticUs,
          phoneticUk: result.phoneticUk,
          ukNote: result.ukNote,
          colloquial: result.colloquial,
          exampleEn: result.exampleEn,
          examplePt: result.examplePt,
          exampleEn2: result.exampleEn2,
          examplePt2: result.examplePt2,
          tip: result.tip,
          isValidForGlobalSchoolDeck: true,
        });
      }
    } catch (err) {
      if (isAbortError(err) || reqId !== lookupReqIdRef.current) {
        return;
      }
      if (isLinguisticOfflineError(err)) {
        setOfflineErrorMsg(err.message);
      } else {
        setOfflineErrorMsg(
          'Instabilidade temporária ao consultar a IA. Tente novamente em instantes ou preencha manualmente.'
        );
      }
    } finally {
      if (reqId === lookupReqIdRef.current) {
        setIsLookingUp(false);
        setLookupStatusText('');
      }
    }
  };

  const handleOpenManualStage = () => {
    void triggerTap();
    cancelInFlightRequests();
    setOfflineErrorMsg(null);
    setFormErrorMsg(null);

    const seedText = magicQuery.trim();
    if (seedText && !term) {
      setTerm(seedText);
      const guessedFolder = classifyTermIntoFolder(seedText);
      setCategory(guessedFolder);
      setSubtopic(
        classifyCardSubtopic({
          term: seedText,
          literal: '',
          exampleEn: '',
        })
      );
    }
    setStage('review_form');
  };

  const handleRegenerateExampleOnly = async () => {
    const cleanTerm = term.trim();
    if (!cleanTerm) {
      setFormErrorMsg('Informe a expressão em inglês antes de gerar outra frase.');
      triggerSubtleShake();
      return;
    }

    void triggerTap();
    setFormErrorMsg(null);
    setOfflineErrorMsg(null);

    // Abort any previous sentence request so rapid clicks never race
    exampleAbortRef.current?.abort();
    const controller = new AbortController();
    exampleAbortRef.current = controller;
    const reqId = ++exampleReqIdRef.current;

    setIsRegeneratingExample(true);

    try {
      const historyToAvoid = Array.from(
        new Set([...seenExamplesHistory, exampleEn].filter(Boolean))
      );

      const generated = await generateNewExampleSentence(
        cleanTerm,
        historyToAvoid,
        1,
        category,
        literal.trim(),
        { signal: controller.signal }
      );

      if (reqId !== exampleReqIdRef.current || controller.signal.aborted) {
        return;
      }

      setExampleEn(generated.exampleEn);
      setExamplePt(generated.examplePt);
      setSeenExamplesHistory((prev) =>
        Array.from(new Set([...prev, generated.exampleEn])).slice(-8)
      );
    } catch (err) {
      if (isAbortError(err) || reqId !== exampleReqIdRef.current) {
        return;
      }
      if (isLinguisticOfflineError(err)) {
        setOfflineErrorMsg(err.message);
      } else {
        setFormErrorMsg('Não foi possível gerar outra frase agora. Tente novamente.');
      }
    } finally {
      if (reqId === exampleReqIdRef.current) {
        setIsRegeneratingExample(false);
      }
    }
  };

  const handleManualExampleEnChange = (nextVal: string) => {
    // Cancel any in-flight regeneration so delayed network responses NEVER overwrite manual typing
    if (exampleAbortRef.current) {
      exampleReqIdRef.current += 1;
      exampleAbortRef.current.abort();
      exampleAbortRef.current = null;
      setIsRegeneratingExample(false);
    }
    setExampleEn(nextVal);
    if (formErrorMsg) setFormErrorMsg(null);
  };

  const handleManualExamplePtChange = (nextVal: string) => {
    if (exampleAbortRef.current) {
      exampleReqIdRef.current += 1;
      exampleAbortRef.current.abort();
      exampleAbortRef.current = null;
      setIsRegeneratingExample(false);
    }
    setExamplePt(nextVal);
    if (formErrorMsg) setFormErrorMsg(null);
  };

  const handleSubmitSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMsg(null);

    const cleanTerm = term.trim();
    const cleanLiteral = literal.trim();
    const cleanExEn = formatCleanExampleSentence(exampleEn);
    const cleanExPt = examplePt.trim();

    if (!cleanTerm) {
      setFormErrorMsg('Preencha a expressão em inglês.');
      triggerSubtleShake();
      return;
    }
    if (!cleanLiteral) {
      setFormErrorMsg('Preencha o significado natural em português.');
      triggerSubtleShake();
      return;
    }
    if (!cleanExEn || cleanExEn.split(/\s+/).length < 2) {
      setFormErrorMsg('Inclua uma frase de exemplo natural em inglês.');
      triggerSubtleShake();
      return;
    }
    if (!cleanExPt) {
      setFormErrorMsg('Inclua a tradução equivalente da frase em português.');
      triggerSubtleShake();
      return;
    }

    const offlineSynth =
      !phoneticUs.trim() || !phoneticUk.trim()
        ? synthesizeOfflinePhrasePhonetics(cleanTerm)
        : { us: '', uk: '' };

    const finalPhonUs = phoneticUs.trim() || offlineSynth.us;
    const finalPhonUk = phoneticUk.trim() || offlineSynth.uk;
    const finalColloquial =
      colloquialList.length > 0
        ? colloquialList
        : cleanLiteral
            .split(/[,;/]/)
            .map((s) => s.trim())
            .filter(Boolean);

    const finalExEn2 = exampleEn2.trim() ? formatCleanExampleSentence(exampleEn2) : cleanExEn;
    const finalExPt2 = examplePt2.trim() || cleanExPt;

    onSave(
      {
        term: cleanTerm,
        category,
        subtopic,
        literal: cleanLiteral,
        phoneticUs: finalPhonUs || undefined,
        phoneticUk: finalPhonUk || undefined,
        ukNote: ukNote.trim() || undefined,
        colloquial: finalColloquial.length > 0 ? finalColloquial : [cleanLiteral],
        exampleEn: cleanExEn,
        examplePt: cleanExPt,
        exampleEn2: finalExEn2,
        examplePt2: finalExPt2,
        tip:
          tip.trim() ||
          'Ouça os áudios US e UK para comparar a pronúncia natural dos nativos.',
      },
      editingCard?.id
    );
  };

  if (!isOpen) return null;

  const modalHeading =
    contextTitle || (editingCard ? 'Editar Card' : 'Novo Card de Estudo');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border border-[#E4E0D8] dark:border-[#2E342F] bg-[#FCFBF8] dark:bg-[#1B1E1B] shadow-2xl overflow-hidden my-auto max-h-[94dvh] flex flex-col ewm-pillar-enter ${
          shakeError ? 'ewm-micro-shake' : ''
        }`}
      >
        {/* Clean Minimalist Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#ECE8DF] dark:border-[#282E29] bg-white/80 dark:bg-[#1E221F]/80">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id="card-modal-title"
                className="font-display font-bold text-base sm:text-lg text-[#1C1B18] dark:text-[#F2EFE8] truncate"
              >
                {modalHeading}
              </h2>
              {stage === 'review_form' && !editingCard && (
                <button
                  type="button"
                  onClick={() => {
                    void triggerTap();
                    cancelInFlightRequests();
                    setOfflineErrorMsg(null);
                    setFormErrorMsg(null);
                    setStage('magic_input');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-[#28665E] dark:text-[#38E5A5] bg-[#EAF3F1] dark:bg-[#172A24] hover:opacity-90 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Nova busca</span>
                </button>
              )}
            </div>
            {contextSubtitle && (
              <p className="text-xs text-[#6B655C] dark:text-[#9FA6A0] truncate mt-0.5">
                {contextSubtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-xl text-[#6B655C] dark:text-[#9FA6A0] hover:bg-[#ECE8DF] dark:hover:bg-[#282E29] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* =================================================================
            ESTÁGIO 1 — ENTRADA ÚNICA MÁGICA (FOCO INICIAL AO ABRIR)
            ================================================================= */}
        {stage === 'magic_input' && (
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <label
                htmlFor="card-magic-protagonist-input"
                className="block text-sm font-semibold text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                Qual palavra ou expressão você quer aprender?
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  ref={magicInputRef}
                  id="card-magic-protagonist-input"
                  type="text"
                  value={magicQuery}
                  disabled={isLookingUp}
                  onChange={(e) => {
                    setMagicQuery(e.target.value);
                    if (formErrorMsg) setFormErrorMsg(null);
                    if (offlineErrorMsg) setOfflineErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleMagicAiAutofill();
                    }
                  }}
                  placeholder="Digite uma palavra ou expressão (em Inglês ou Português)..."
                  className="flex-1 min-w-0 px-4 py-3.5 rounded-2xl border border-[#D8D3C8] dark:border-[#333B35] bg-white dark:bg-[#222723] text-sm sm:text-[15px] text-[#1C1B18] dark:text-[#F4F2EC] placeholder:text-[#8C857B] dark:placeholder:text-[#7D857F] focus:outline-none focus:border-[#38E5A5] focus:ring-2 focus:ring-[#38E5A5]/20 transition-all"
                />

                <button
                  type="button"
                  disabled={isLookingUp || !magicQuery.trim()}
                  onClick={() => void handleMagicAiAutofill()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#38E5A5] hover:bg-[#2FD497] disabled:opacity-50 text-[#0B1F17] font-bold text-sm shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isLookingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Preenchendo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>✨ Preencher com IA</span>
                    </>
                  )}
                </button>
              </div>

              {isLookingUp && lookupStatusText && (
                <p className="text-xs text-[#28665E] dark:text-[#38E5A5] font-medium flex items-center gap-1.5 pt-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#38E5A5] animate-ping" />
                  <span>{lookupStatusText}</span>
                </p>
              )}
            </div>

            {/* Instant 0ms Anti-Duplicate Notice */}
            {duplicateCard && !isLookingUp && (
              <div className="rounded-2xl border border-[#C6DBD7] dark:border-[#2E4B44] bg-[#F1F8F6] dark:bg-[#162621] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ewm-pillar-enter">
                <div className="space-y-0.5 min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F564E] dark:text-[#38E5A5]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Já existe no seu acervo!</span>
                  </div>
                  <p className="text-sm font-bold text-[#1C1B18] dark:text-[#F2EFE8] truncate">
                    {duplicateCard.term}{' '}
                    <span className="font-normal text-[#5C574E] dark:text-[#A9B0AA]">
                      — {duplicateCard.literal}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenExistingDuplicate(duplicateCard)}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#22332D] border border-[#BFD7D2] dark:border-[#38E5A5]/30 text-xs font-bold text-[#1E4E47] dark:text-[#38E5A5] hover:border-[#38E5A5] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Visualizar / Editar card
                </button>
              </div>
            )}

            {/* Honest Offline Reconnection State */}
            {offlineErrorMsg && (
              <div className="rounded-2xl border border-[#E6CFC8] dark:border-[#4B2E2B] bg-[#FDF6F4] dark:bg-[#291C1B] p-4 space-y-2.5 ewm-pillar-enter">
                <div className="flex items-start gap-2.5 text-xs text-[#8C332B] dark:text-[#F3B7B1]">
                  <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">{offlineErrorMsg}</p>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <button
                    type="button"
                    onClick={() => void handleMagicAiAutofill()}
                    className="px-3 py-1.5 rounded-lg bg-[#8C332B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenManualStage}
                    className="px-3 py-1.5 rounded-lg border border-[#D8BEB7] dark:border-[#573835] text-xs font-semibold text-[#6E2822] dark:text-[#F3B7B1] cursor-pointer"
                  >
                    Preencher manualmente
                  </button>
                </div>
              </div>
            )}

            {formErrorMsg && (
              <div className="rounded-xl border border-[#E6CFC8] dark:border-[#4B2E2B] bg-[#FDF6F4] dark:bg-[#291C1B] px-3.5 py-2.5 text-xs font-medium text-[#8C332B] dark:text-[#F3B7B1] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErrorMsg}</span>
              </div>
            )}

            {/* Subtle Secondary Manual Trigger */}
            <div className="pt-2 border-t border-[#ECE8DF] dark:border-[#262C27] flex items-center justify-between">
              <button
                type="button"
                onClick={handleOpenManualStage}
                className="text-xs font-medium text-[#6B655C] dark:text-[#9CA39D] hover:text-[#1C1B18] dark:hover:text-[#F2EFE8] underline underline-offset-4 cursor-pointer"
              >
                Ou preencher campos manualmente
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#6B655C] dark:text-[#9CA39D] hover:bg-[#ECE8DF] dark:hover:bg-[#262C27] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* =================================================================
            ESTÁGIO 2 — REVISÃO ESCANEÁVEL EM 3 BLOCOS LIMPOS (180ms)
            ================================================================= */}
        {stage === 'review_form' && (
          <form
            onSubmit={handleSubmitSave}
            className="p-5 sm:p-6 space-y-5 overflow-y-auto ewm-pillar-enter"
          >
            {/* Anti-duplicate alert when typing manually in Stage 2 */}
            {duplicateCard && !editingCard && (
              <div className="rounded-2xl border border-[#C6DBD7] dark:border-[#2E4B44] bg-[#F1F8F6] dark:bg-[#162621] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-[#1F564E] dark:text-[#9EE8CD] truncate">
                  <strong>{duplicateCard.term}</strong> já existe no seu acervo.
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenExistingDuplicate(duplicateCard)}
                  className="font-bold text-[#1E4E47] dark:text-[#38E5A5] underline shrink-0 cursor-pointer"
                >
                  Abrir existente
                </button>
              </div>
            )}

            {/* BLOCO 1 — ESSÊNCIA (TERMO & TRADUÇÃO) */}
            <section className="space-y-3" aria-label="Essência do card">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Expressão em Inglês + Mini Preview US / UK */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="card-term-en"
                      className="text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#A3ABA5]"
                    >
                      Expressão em Inglês
                    </label>
                    <div className="inline-flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!term.trim()}
                        onClick={() => void toggleSpeakEnglishText(term.trim(), 'us')}
                        title="Ouvir pronúncia americana (US)"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[#D8D3C8] dark:border-[#333B35] bg-white dark:bg-[#252B26] text-[10px] font-bold text-[#28665E] dark:text-[#38E5A5] disabled:opacity-40 cursor-pointer"
                      >
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>US</span>
                      </button>
                      <button
                        type="button"
                        disabled={!term.trim()}
                        onClick={() => void toggleSpeakEnglishText(term.trim(), 'uk')}
                        title="Ouvir pronúncia britânica (UK)"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[#D8D3C8] dark:border-[#333B35] bg-white dark:bg-[#252B26] text-[10px] font-bold text-[#244B6B] dark:text-[#8CC2F0] disabled:opacity-40 cursor-pointer"
                      >
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>UK</span>
                      </button>
                    </div>
                  </div>
                  <input
                    id="card-term-en"
                    type="text"
                    value={term}
                    onChange={(e) => {
                      setTerm(e.target.value);
                      if (formErrorMsg) setFormErrorMsg(null);
                    }}
                    placeholder="Ex: Call it a day"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD8CE] dark:border-[#323A34] bg-white dark:bg-[#232824] text-sm font-semibold text-[#1C1B18] dark:text-[#F4F2EC] focus:outline-none focus:border-[#38E5A5]"
                  />
                </div>

                {/* Significado Natural em Português */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="card-meaning-pt"
                    className="block text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#A3ABA5]"
                  >
                    Significado Natural (PT-BR)
                  </label>
                  <input
                    id="card-meaning-pt"
                    type="text"
                    value={literal}
                    onChange={(e) => {
                      setLiteral(e.target.value);
                      if (formErrorMsg) setFormErrorMsg(null);
                    }}
                    placeholder="Ex: Encerrar o expediente por hoje"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD8CE] dark:border-[#323A34] bg-white dark:bg-[#232824] text-sm text-[#1C1B18] dark:text-[#F4F2EC] focus:outline-none focus:border-[#38E5A5]"
                  />
                </div>
              </div>

              {/* Compact Discreet 1-Line Usage / Pronunciation Bar (Expandable on click) */}
              <div className="rounded-xl border border-[#EAE6DD] dark:border-[#29302B] bg-[#F6F4EF]/80 dark:bg-[#202421] px-3 py-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTip((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left text-xs text-[#5C574E] dark:text-[#A8B0AA] cursor-pointer"
                >
                  <span className="truncate">
                    {phoneticUs ? (
                      <span className="font-mono-num text-[#28665E] dark:text-[#68B4A8] mr-2">
                        US {phoneticUs}
                        {phoneticUk ? ` · UK ${phoneticUk}` : ''}
                      </span>
                    ) : null}
                    {tip ? (
                      <span>💡 {tip}</span>
                    ) : (
                      <span className="opacity-75">Adicionar dica curta de uso ou pronúncia (opcional)</span>
                    )}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isEditingTip ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isEditingTip && (
                  <div className="pt-2 mt-2 border-t border-[#E5E0D6] dark:border-[#2C332E]">
                    <input
                      type="text"
                      value={tip}
                      onChange={(e) => setTip(e.target.value)}
                      placeholder="Ex: Usado ao parar um trabalho ou tarefa pelo resto do dia."
                      className="w-full px-3 py-2 rounded-lg border border-[#DDD8CE] dark:border-[#323A34] bg-white dark:bg-[#1B1F1C] text-xs text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:border-[#38E5A5]"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* BLOCO 2 — CONTEXTO REAL (CARD ÚNICO DE EXEMPLO + 🔄 OUTRA FRASE) */}
            <section
              aria-label="Contexto real de exemplo"
              className="rounded-2xl border border-[#DFDBD0] dark:border-[#2E3630] bg-white dark:bg-[#212622] p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#A3ABA5]">
                    Contexto Real (Exemplo)
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!exampleEn.trim() || isRegeneratingExample}
                      onClick={() => void toggleSpeakEnglishText(exampleEn.trim(), 'us')}
                      title="Ouvir frase em inglês americano (US)"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-[#28665E] dark:text-[#38E5A5] hover:bg-[#EAF3F1] dark:hover:bg-[#1A2E27] disabled:opacity-40 cursor-pointer"
                    >
                      <Volume2 className="w-2.5 h-2.5" />
                      <span>US</span>
                    </button>
                    <button
                      type="button"
                      disabled={!exampleEn.trim() || isRegeneratingExample}
                      onClick={() => void toggleSpeakEnglishText(exampleEn.trim(), 'uk')}
                      title="Ouvir frase em inglês britânico (UK)"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-[#244B6B] dark:text-[#8CC2F0] hover:bg-[#EDF3F8] dark:hover:bg-[#1B2834] disabled:opacity-40 cursor-pointer"
                    >
                      <Volume2 className="w-2.5 h-2.5" />
                      <span>UK</span>
                    </button>
                  </div>
                </div>

                {/* Single Clean Top-Right Regenerate Button */}
                <button
                  type="button"
                  disabled={isRegeneratingExample || !term.trim()}
                  onClick={() => void handleRegenerateExampleOnly()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#CDE0DC] dark:border-[#38E5A5]/30 bg-[#F2F9F7] dark:bg-[#172A24] text-xs font-semibold text-[#1E524A] dark:text-[#38E5A5] hover:border-[#38E5A5] disabled:opacity-45 cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isRegeneratingExample ? 'animate-spin' : ''}`}
                  />
                  <span>{isRegeneratingExample ? 'Gerando...' : 'Outra frase'}</span>
                </button>
              </div>

              {isRegeneratingExample ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-2.5 py-2 animate-pulse"
                >
                  <div className="h-9 w-full rounded-xl bg-[#ECE8DF] dark:bg-[#2B322D]" />
                  <div className="h-9 w-5/6 rounded-xl bg-[#F2EFE8] dark:bg-[#262C28]" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label htmlFor="card-example-en" className="sr-only">
                      Frase de exemplo em inglês
                    </label>
                    <textarea
                      id="card-example-en"
                      rows={2}
                      value={exampleEn}
                      onChange={(e) => handleManualExampleEnChange(e.target.value)}
                      placeholder="Frase natural em inglês aplicando a expressão..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#313832] bg-[#FAF9F6] dark:bg-[#1B1F1C] text-sm font-medium text-[#1C1B18] dark:text-[#F4F2EC] resize-none focus:outline-none focus:border-[#38E5A5]"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-example-pt" className="sr-only">
                      Tradução natural da frase em português
                    </label>
                    <textarea
                      id="card-example-pt"
                      rows={2}
                      value={examplePt}
                      onChange={(e) => handleManualExamplePtChange(e.target.value)}
                      placeholder="Tradução idiomática equivalente em português..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#313832] bg-[#FAF9F6] dark:bg-[#1B1F1C] text-xs sm:text-sm text-[#5C574E] dark:text-[#C5CBC6] resize-none focus:outline-none focus:border-[#38E5A5]"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* BLOCO 3 — ORGANIZAÇÃO INTELIGENTE COMPACTA (PASTA & SUBTÓPICO OFICIAIS) */}
            <section className="space-y-3" aria-label="Organização em Pasta e Subtópico">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#A3ABA5]">
                  <Folder className="w-3.5 h-3.5 text-[#28665E] dark:text-[#38E5A5]" />
                  <span>Pasta</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VALID_FOLDERS.map((folder) => {
                    const active = category === folder;
                    return (
                      <button
                        key={folder}
                        type="button"
                        onClick={() => {
                          void triggerTap();
                          setCategory(folder);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                          active
                            ? 'bg-[#1E4E47] dark:bg-[#38E5A5]/18 border-[#1E4E47] dark:border-[#38E5A5] text-white dark:text-[#38E5A5]'
                            : 'bg-white dark:bg-[#222723] border-[#DFDBD0] dark:border-[#313832] text-[#5C574E] dark:text-[#B4BBB5] hover:border-[#28665E]'
                        }`}
                      >
                        {folder}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5C574E] dark:text-[#A3ABA5]">
                  <Tag className="w-3.5 h-3.5 text-[#28665E] dark:text-[#38E5A5]" />
                  <span>Subtópico</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VALID_SUBTOPICS.map((sub) => {
                    const active = subtopic === sub.key;
                    return (
                      <button
                        key={sub.key}
                        type="button"
                        onClick={() => {
                          void triggerTap();
                          setSubtopic(sub.key);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                          active
                            ? 'bg-[#EAF3F1] dark:bg-[#213831] border-[#28665E] dark:border-[#38E5A5]/70 text-[#1C4B44] dark:text-[#7CECC2]'
                            : 'bg-white dark:bg-[#222723] border-[#DFDBD0] dark:border-[#313832] text-[#5C574E] dark:text-[#B4BBB5] hover:border-[#28665E]'
                        }`}
                      >
                        {sub.shortLabel || sub.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Offline or Validation Feedback */}
            {offlineErrorMsg && (
              <div className="rounded-xl border border-[#E6CFC8] dark:border-[#4B2E2B] bg-[#FDF6F4] dark:bg-[#291C1B] px-3.5 py-2.5 text-xs font-medium text-[#8C332B] dark:text-[#F3B7B1] flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>{offlineErrorMsg}</span>
              </div>
            )}

            {formErrorMsg && (
              <div className="rounded-xl border border-[#E6CFC8] dark:border-[#4B2E2B] bg-[#FDF6F4] dark:bg-[#291C1B] px-3.5 py-2.5 text-xs font-medium text-[#8C332B] dark:text-[#F3B7B1] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErrorMsg}</span>
              </div>
            )}

            {/* CLEAN ACTION FOOTER */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#ECE8DF] dark:border-[#282E29]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#6B655C] dark:text-[#A3ABA5] hover:bg-[#ECE8DF] dark:hover:bg-[#272D28] cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isRegeneratingExample}
                className="px-6 py-2.5 rounded-xl bg-[#38E5A5] hover:bg-[#2FD497] disabled:opacity-50 text-[#0B1F17] text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
              >
                Salvar Card
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
