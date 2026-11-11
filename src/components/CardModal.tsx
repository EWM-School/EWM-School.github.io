import { AlertCircle, CheckCircle2, Globe, Sparkles, Volume2, Wand2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VALID_FOLDERS, VALID_SUBTOPICS } from '../data/seedData';
import type { Flashcard, SubtopicKey, TopicFolder } from '../types/flashcard';
import {
  generateNewExampleSentence,
  lookupSmartCardContent,
  type TripleCheckStage,
} from '../utils/aiLookup';
import {
  classifyCardSubtopic,
  classifyTermIntoFolder,
  getCardSecondExample,
} from '../utils/deckHelpers';
import { auditEnglishGrammarAndCollocations } from '../utils/grammarEngine';
import {
  fetchVerifiedPhoneticsForTerm,
  getCardPhonetics,
  synthesizeOfflinePhrasePhonetics,
} from '../utils/phonetics';
import { speakEnglishText } from '../utils/speech';

interface CardModalProps {
  isOpen: boolean;
  editingCard: Flashcard | null;
  allCards: Flashcard[];
  contextTitle?: string;
  contextSubtitle?: string;
  onClose: () => void;
  onSave: (cardData: Omit<Flashcard, 'id' | 'status'>, existingId?: string) => void;
}

export function CardModal({
  isOpen,
  editingCard,
  allCards,
  contextTitle,
  contextSubtitle,
  onClose,
  onSave,
}: CardModalProps) {
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<TopicFolder>('Frases');
  const [subtopic, setSubtopic] = useState<SubtopicKey>('Casual');
  const [literal, setLiteral] = useState('');
  const [colloquialInput, setColloquialInput] = useState('');
  const [phoneticUs, setPhoneticUs] = useState('');
  const [phoneticUk, setPhoneticUk] = useState('');
  const [ukNote, setUkNote] = useState('');
  const [exampleEn, setExampleEn] = useState('');
  const [examplePt, setExamplePt] = useState('');
  const [exampleEn2, setExampleEn2] = useState('');
  const [examplePt2, setExamplePt2] = useState('');
  const [tip, setTip] = useState('');

  const [lookupDirection, setLookupDirection] = useState<'en-to-pt' | 'pt-to-en'>('en-to-pt');
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isGeneratingPhonetics, setIsGeneratingPhonetics] = useState(false);
  const [isGeneratingSentence, setIsGeneratingSentence] = useState<1 | 2 | null>(null);
  const [checkStage, setCheckStage] = useState<TripleCheckStage>('idle');
  const [checkMessage, setCheckMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<{ uri: string; title?: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setValidationError(null);
    setCheckStage('idle');
    setCheckMessage('');
    setLookupQuery('');
    setIsGeneratingSentence(null);
    setGroundingSources([]);

    if (editingCard) {
      const sec = getCardSecondExample(editingCard);
      const resolved = getCardPhonetics(editingCard);
      setTerm(editingCard.term);
      setCategory(editingCard.category);
      setSubtopic(editingCard.subtopic);
      setLiteral(resolved.meaning || editingCard.literal);
      setColloquialInput((editingCard.colloquial || []).join(', '));
      setPhoneticUs(resolved.us);
      setPhoneticUk(resolved.uk);
      setUkNote(resolved.ukNote || '');
      setExampleEn(editingCard.exampleEn);
      setExamplePt(editingCard.examplePt);
      setExampleEn2(sec.en);
      setExamplePt2(sec.pt);
      setTip(editingCard.tip || '');
    } else {
      setTerm('');
      setCategory('Frases');
      setSubtopic('Casual');
      setLiteral('');
      setColloquialInput('');
      setPhoneticUs('');
      setPhoneticUk('');
      setUkNote('');
      setExampleEn('');
      setExamplePt('');
      setExampleEn2('');
      setExamplePt2('');
      setTip('');
    }
  }, [isOpen, editingCard]);

  if (!isOpen) return null;

  const handleSmartAutoFill = async (overrideTerm?: string) => {
    const query = (overrideTerm || lookupQuery || term).trim();
    if (!query) {
      setValidationError('Digite uma palavra ou expressão para preencher automaticamente.');
      return null;
    }
    setValidationError(null);
    setIsLookingUp(true);
    try {
      const res = await lookupSmartCardContent(
        query,
        lookupDirection,
        allCards,
        (stage, msg) => {
          setCheckStage(stage);
          setCheckMessage(msg);
        }
      );
      if (res) {
        setTerm(res.term);
        setCategory(res.category);
        setSubtopic(res.subtopic);
        setLiteral(res.literal);
        setColloquialInput(res.colloquial.join(', '));
        setPhoneticUs(res.phoneticUs);
        setPhoneticUk(res.phoneticUk);
        setUkNote(res.ukNote || '');
        if (res.exampleEn) setExampleEn(res.exampleEn);
        if (res.examplePt) setExamplePt(res.examplePt);
        if (res.exampleEn2) setExampleEn2(res.exampleEn2);
        if (res.examplePt2) setExamplePt2(res.examplePt2);
        setTip(res.tip);
        if (res.groundingSources && res.groundingSources.length > 0) {
          setGroundingSources(res.groundingSources);
        }
        return res;
      }
    } finally {
      setIsLookingUp(false);
    }
    return null;
  };

  const handleGenerateNewSentence = async (slot: 1 | 2) => {
    const cleanTerm = term.trim() || lookupQuery.trim();
    if (!cleanTerm) {
      setValidationError('Informe a palavra ou expressão em inglês antes de gerar uma nova frase.');
      return;
    }
    setValidationError(null);
    setIsGeneratingSentence(slot);
    setCheckStage(2);
    setCheckMessage(`Buscando nova frase real no Google com Gemini para "${cleanTerm}"...`);

    try {
      const currentList = [exampleEn, exampleEn2].filter(Boolean);
      const res = await generateNewExampleSentence(
        cleanTerm,
        currentList,
        slot,
        category,
        literal || colloquialInput
      );

      if (res && res.exampleEn) {
        if (slot === 1) {
          setExampleEn(res.exampleEn);
          setExamplePt(res.examplePt);
        } else {
          setExampleEn2(res.exampleEn);
          setExamplePt2(res.examplePt);
        }
        setCheckStage('done');
        setCheckMessage(
          `Nova frase gerada e verificada com sucesso via ${res.sourceLabel}!${
            res.contextTip ? ` (${res.contextTip})` : ''
          }`
        );
        if (res.groundingSources && res.groundingSources.length > 0) {
          setGroundingSources(res.groundingSources);
        }
      }
    } catch {
      setValidationError('Não foi possível gerar uma nova frase no momento.');
    } finally {
      setIsGeneratingSentence(null);
    }
  };

  const handleGeneratePhonetics = async () => {
    const clean = term.trim();
    if (!clean) {
      setValidationError('Informe a expressão em inglês antes de gerar a fonética US & UK.');
      return;
    }
    setValidationError(null);
    setIsGeneratingPhonetics(true);
    try {
      const verified = await fetchVerifiedPhoneticsForTerm(clean);
      setPhoneticUs(verified.phoneticUs);
      setPhoneticUk(verified.phoneticUk);
      if (verified.ukNote && !ukNote.trim()) {
        setUkNote(verified.ukNote);
      }
    } finally {
      setIsGeneratingPhonetics(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    let cleanTerm = term.trim();
    let cleanLiteral = literal.trim();
    let colList = colloquialInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let cleanEx1En = exampleEn.trim();
    let cleanEx1Pt = examplePt.trim();
    let cleanEx2En = exampleEn2.trim();
    let cleanEx2Pt = examplePt2.trim();

    if (!cleanTerm) {
      setValidationError('Informe a expressão ou palavra em inglês.');
      return;
    }

    // 100% Complete Guarantee: if user didn't fill translations or examples, auto-fill them now
    if (colList.length === 0 || !cleanEx1En) {
      const autoRes = await handleSmartAutoFill(cleanTerm);
      if (autoRes) {
        cleanTerm = autoRes.term;
        cleanLiteral = autoRes.literal;
        colList = autoRes.colloquial;
        cleanEx1En = autoRes.exampleEn;
        cleanEx1Pt = autoRes.examplePt;
        cleanEx2En = autoRes.exampleEn2 || autoRes.exampleEn;
        cleanEx2Pt = autoRes.examplePt2 || autoRes.examplePt;
      }
    }

    if (colList.length === 0) {
      setValidationError('Informe pelo menos uma tradução coloquial em português.');
      return;
    }

    if (!cleanEx1En) {
      setValidationError('Informe o Exemplo 1 em inglês.');
      return;
    }

    if (cleanEx1En.length < 12) {
      setValidationError('Exemplo 1 deve ter pelo menos 12 caracteres para demonstrar contexto real.');
      return;
    }
    if (cleanEx1En.length > 260) {
      setValidationError('Exemplo 1 deve ter no máximo 260 caracteres.');
      return;
    }

    const audit1 = auditEnglishGrammarAndCollocations(cleanEx1En, cleanTerm);
    if (!audit1.valid) {
      setValidationError(`Exemplo 1: ${audit1.reason}`);
      return;
    }

    if (cleanEx2En) {
      if (cleanEx2En.length < 12) {
        setValidationError('Exemplo 2 deve ter pelo menos 12 caracteres para demonstrar contexto real.');
        return;
      }
      if (cleanEx2En.length > 260) {
        setValidationError('Exemplo 2 deve ter no máximo 260 caracteres.');
        return;
      }
      const audit2 = auditEnglishGrammarAndCollocations(cleanEx2En, cleanTerm);
      if (!audit2.valid) {
        setValidationError(`Exemplo 2: ${audit2.reason}`);
        return;
      }
    } else {
      cleanEx2En = cleanEx1En;
      cleanEx2Pt = cleanEx1Pt;
    }

    const fallbackResolved = getCardPhonetics({
      id: editingCard?.id || '',
      term: cleanTerm,
      literal: cleanLiteral,
      phoneticUs: phoneticUs.trim() || undefined,
      phoneticUk: phoneticUk.trim() || undefined,
      ukNote: ukNote.trim() || undefined,
    });
    const offlineFallback = synthesizeOfflinePhrasePhonetics(cleanTerm);
    const finalPhoneticUs = phoneticUs.trim() || fallbackResolved.us || offlineFallback.us;
    const finalPhoneticUk = phoneticUk.trim() || fallbackResolved.uk || offlineFallback.uk;

    onSave(
      {
        term: cleanTerm,
        category: category || classifyTermIntoFolder(cleanTerm, editingCard?.id),
        subtopic:
          subtopic ||
          classifyCardSubtopic({ term: cleanTerm, literal: cleanLiteral, exampleEn: cleanEx1En }),
        literal: cleanLiteral || colList[0],
        colloquial: colList,
        phoneticUs: finalPhoneticUs,
        phoneticUk: finalPhoneticUk,
        ukNote: ukNote.trim() || undefined,
        exampleEn: cleanEx1En,
        examplePt: cleanEx1Pt || `→ ${colList[0]}`,
        exampleEn2: cleanEx2En,
        examplePt2: cleanEx2Pt || cleanEx1Pt,
        tip: tip.trim() || 'Expressão autêntica com áudio nos sotaques Americano (US) e Britânico (UK).',
        modified: true,
        updatedAt: Date.now(),
      },
      editingCard?.id
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-modal-title"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#ECE9E1] dark:border-[#2A2F2A] bg-white/95 dark:bg-[#212421]/95 backdrop-blur-xs">
          <div>
            <h2
              id="card-modal-title"
              className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
            >
              {contextTitle || (editingCard ? 'Editar Flashcard' : 'Novo Flashcard')}
            </h2>
            {contextSubtitle && (
              <p className="text-xs text-[#28665E] dark:text-[#68B4A8] font-medium mt-0.5">
                {contextSubtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Smart Lookup Helper */}
          <div className="rounded-2xl border border-[#DCE5E2] dark:border-[#2F4B46] bg-[#F4F8F7] dark:bg-[#1B2926] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#225851] dark:text-[#86CEC2] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Preenchimento Inteligente (Base EWM + Fonética US &amp; UK)</span>
              </span>

              <div className="inline-flex p-0.5 rounded-lg bg-[#E1ECE9] dark:bg-[#243734] text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLookupDirection('en-to-pt')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                    lookupDirection === 'en-to-pt'
                      ? 'bg-white dark:bg-[#2A6D63] text-[#1C1B18] dark:text-[#F4F7F6]'
                      : 'text-[#4E6964] dark:text-[#A4CAC3]'
                  }`}
                >
                  Inglês &rarr; PT
                </button>
                <button
                  type="button"
                  onClick={() => setLookupDirection('pt-to-en')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                    lookupDirection === 'pt-to-en'
                      ? 'bg-white dark:bg-[#2A6D63] text-[#1C1B18] dark:text-[#F4F7F6]'
                      : 'text-[#4E6964] dark:text-[#A4CAC3]'
                  }`}
                >
                  PT &rarr; Inglês
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSmartAutoFill();
                  }
                }}
                placeholder={
                  lookupDirection === 'en-to-pt'
                    ? 'Ex: figure out, reschedule, no-brainer...'
                    : 'Ex: dar um jeito, resumir, ficar com pé atrás...'
                }
                className="flex-1 px-3.5 py-2 rounded-xl border border-[#D4DFDC] dark:border-[#324D48] bg-white dark:bg-[#212421] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
              />
              <button
                type="button"
                onClick={() => void handleSmartAutoFill()}
                disabled={isLookingUp}
                className="px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                {isLookingUp ? 'Consultando...' : 'Preencher'}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateNewSentence(exampleEn ? 2 : 1)}
                disabled={isGeneratingSentence !== null || (!term.trim() && !lookupQuery.trim())}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#D4DFDC] dark:border-[#324D48] bg-white dark:bg-[#212421] text-xs font-semibold text-[#28665E] dark:text-[#86CEC2] hover:bg-[#EAF3F1] dark:hover:bg-[#253D39] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                title="Buscar automaticamente nova frase real gerada pelo Gemini no banco de dados do Google"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingSentence !== null ? 'Pesquisando...' : 'Gerar nova frase'}</span>
              </button>
            </div>

            {checkStage !== 'idle' && (
              <div
                className={`text-xs flex flex-col gap-1 font-medium ${
                  checkStage === 'blocked'
                    ? 'text-[#9A5B13] dark:text-[#E6B472]'
                    : 'text-[#2C6B4F] dark:text-[#78C9A2]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{checkMessage}</span>
                </div>
                {groundingSources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-5 pt-0.5 text-[11px] text-[#5C574E] dark:text-[#AFAAA0]">
                    <span className="flex items-center gap-1 font-semibold text-[#28665E] dark:text-[#86CEC2]">
                      <Globe className="w-3 h-3" />
                      Google Search Grounding:
                    </span>
                    {groundingSources.slice(0, 3).map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-[#28665E] dark:hover:text-[#86CEC2] truncate max-w-[200px]"
                      >
                        {s.title || s.uri}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {validationError && (
            <div className="rounded-xl border border-[#E6B8B5] dark:border-[#5D3330] bg-[#FDF2F2] dark:bg-[#311F1E] px-3.5 py-2.5 text-xs font-medium text-[#8F312B] dark:text-[#F4BCB8] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Term, Folder, Subtopic */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="card-term-input"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Expressão / Palavra (EN) *
                </label>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!term.trim()}
                    onClick={() => void speakEnglishText(term.trim(), 'us')}
                    aria-label="Testar pronúncia em inglês americano"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[11px] font-semibold text-[#28665E] dark:text-[#86CEC2] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Ouvir US</span>
                  </button>
                  <button
                    type="button"
                    disabled={!term.trim()}
                    onClick={() => void speakEnglishText(term.trim(), 'uk')}
                    aria-label="Testar pronúncia em inglês britânico"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[11px] font-semibold text-[#28665E] dark:text-[#86CEC2] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Ouvir UK</span>
                  </button>
                </div>
              </div>
              <input
                id="card-term-input"
                type="text"
                required
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Ex: Wrap up"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="card-topic-select"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Tópico
              </label>
              <select
                id="card-topic-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TopicFolder)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                {VALID_FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="card-subtopic-select"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Subtópico
              </label>
              <select
                id="card-subtopic-select"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value as SubtopicKey)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                {VALID_SUBTOPICS.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="card-colloquial-input"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Traduções Coloquiais (separadas por vírgula) *
              </label>
              <input
                id="card-colloquial-input"
                type="text"
                required
                value={colloquialInput}
                onChange={(e) => setColloquialInput(e.target.value)}
                placeholder="Ex: Encerrar, Fechar com chave de ouro"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="card-literal-input"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Sentido Literal / Contexto Base
              </label>
              <input
                id="card-literal-input"
                type="text"
                value={literal}
                onChange={(e) => setLiteral(e.target.value)}
                placeholder="Ex: Embrulhar / Concluir uma atividade"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>
          </div>

          {/* Dual Native Phonetics (EWM-US & EWM-UK) */}
          <div className="rounded-2xl border border-[#ECE9E1] dark:border-[#303630] bg-[#FAF9F6] dark:bg-[#1B1E1B] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                  Pacote Fonético Nativo (EWM-US &amp; EWM-UK)
                </h3>
                <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0]">
                  Se deixar em branco, o sistema gera automaticamente as duas transcrições verificadas ao salvar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleGeneratePhonetics()}
                disabled={isGeneratingPhonetics || !term.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D4DFDC] dark:border-[#2F4B46] bg-white dark:bg-[#262A26] text-xs font-semibold text-[#28665E] dark:text-[#86CEC2] hover:border-[#28665E] dark:hover:border-[#68B4A8] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{isGeneratingPhonetics ? 'Verificando...' : 'Gerar fonética US & UK'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="card-phonetic-us"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Pronúncia US (EWM-US)
                </label>
                <input
                  id="card-phonetic-us"
                  type="text"
                  value={phoneticUs}
                  onChange={(e) => setPhoneticUs(e.target.value)}
                  placeholder="Ex: /ri-SKÉ-djul/ ou /rép ÂP/"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs sm:text-sm font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="card-phonetic-uk"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Pronúncia UK (EWM-UK)
                </label>
                <input
                  id="card-phonetic-uk"
                  type="text"
                  value={phoneticUk}
                  onChange={(e) => setPhoneticUk(e.target.value)}
                  placeholder="Ex: /ri-XÉ-diul/ ou /rép ÂP/"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs sm:text-sm font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="card-uk-note"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Nota / Equivalente Britânico (UK — opcional)
              </label>
              <input
                id="card-uk-note"
                type="text"
                value={ukNote}
                onChange={(e) => setUkNote(e.target.value)}
                placeholder="Ex: No Reino Unido também é comum dizer 'Take it with a pinch of salt'."
                className="w-full px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>
          </div>

          {/* Examples Pair 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="card-example1-en"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Exemplo 1 (Inglês) *
                </label>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isGeneratingSentence !== null || !term.trim()}
                    onClick={() => void handleGenerateNewSentence(1)}
                    title="Buscar automaticamente nova frase real gerada pelo Gemini no banco de dados do Google"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#28665E] dark:text-[#86CEC2] hover:bg-[#D8EAE6] dark:hover:bg-[#253D39] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isGeneratingSentence === 1 ? 'Gerando...' : 'Gerar nova frase'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!exampleEn.trim()}
                    onClick={() => void speakEnglishText(exampleEn.trim(), 'us')}
                    aria-label="Ouvir Exemplo 1 em inglês americano"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#28665E] dark:hover:text-[#86CEC2] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>US</span>
                  </button>
                  <button
                    type="button"
                    disabled={!exampleEn.trim()}
                    onClick={() => void speakEnglishText(exampleEn.trim(), 'uk')}
                    aria-label="Ouvir Exemplo 1 em inglês britânico"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#28665E] dark:hover:text-[#86CEC2] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>UK</span>
                  </button>
                </div>
              </div>
              <textarea
                id="card-example1-en"
                rows={2}
                required
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                placeholder="Ex: Let's wrap up this meeting before lunch."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="card-example1-pt"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Tradução Natural 1 (PT-BR) *
              </label>
              <textarea
                id="card-example1-pt"
                rows={2}
                required
                value={examplePt}
                onChange={(e) => setExamplePt(e.target.value)}
                placeholder="Ex: Vamos encerrar essa reunião antes do almoço."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>
          </div>

          {/* Examples Pair 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="card-example2-en"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Exemplo 2 (Inglês — opcional)
                </label>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isGeneratingSentence !== null || !term.trim()}
                    onClick={() => void handleGenerateNewSentence(2)}
                    title="Buscar automaticamente nova frase 2 gerada pelo Gemini no banco de dados do Google"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#28665E] dark:text-[#86CEC2] hover:bg-[#D8EAE6] dark:hover:bg-[#253D39] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isGeneratingSentence === 2 ? 'Gerando...' : 'Gerar nova frase 2'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!exampleEn2.trim()}
                    onClick={() => void speakEnglishText(exampleEn2.trim(), 'us')}
                    aria-label="Ouvir Exemplo 2 em inglês americano"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#28665E] dark:hover:text-[#86CEC2] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>US</span>
                  </button>
                  <button
                    type="button"
                    disabled={!exampleEn2.trim()}
                    onClick={() => void speakEnglishText(exampleEn2.trim(), 'uk')}
                    aria-label="Ouvir Exemplo 2 em inglês britânico"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#28665E] dark:hover:text-[#86CEC2] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>UK</span>
                  </button>
                </div>
              </div>
              <textarea
                id="card-example2-en"
                rows={2}
                value={exampleEn2}
                onChange={(e) => setExampleEn2(e.target.value)}
                placeholder="Ex: We wrapped up the project two days early."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="card-example2-pt"
                className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
              >
                Tradução Natural 2 (PT-BR)
              </label>
              <textarea
                id="card-example2-pt"
                rows={2}
                value={examplePt2}
                onChange={(e) => setExamplePt2(e.target.value)}
                placeholder="Ex: A gente finalizou o projeto dois dias antes."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="card-tip-input"
              className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
            >
              Dica de Uso / Contexto
            </label>
            <input
              id="card-tip-input"
              type="text"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="Ex: Muito usado para encerrar reuniões ou tarefas no trabalho."
              className="w-full px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ECE9E1] dark:border-[#2A2F2A]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {editingCard ? 'Salvar Alterações' : 'Criar Flashcard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
