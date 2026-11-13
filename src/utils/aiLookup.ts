import {
  AI_COLLOQUIAL_KB,
  AI_PT_TO_EN_KB,
  INITIAL_CARDS,
} from '../data/seedData';
import {
  LinguisticOfflineError,
  isAbortError,
  isLinguisticOfflineError,
} from '../services/linguisticEngineClient';
import { getNetworkSnapshot } from '../services/sync/networkMonitor';
import { getLinguisticCacheLocal } from '../services/sync/offlineStorage';
import type { Flashcard, SubtopicKey, TopicFolder } from '../types/flashcard';
import {
  classifyCardSubtopic,
  classifyTermIntoFolder,
  getCardSecondExample,
} from './deckHelpers';
import { normalizePhrasalLookupKey } from './grammarEngine';
import {
  detectInputLanguagePtOrEn,
  doesSentenceContainExpression,
  formatCleanExampleSentence,
  normalizeOfficialFolder,
  normalizeOfficialSubtopic,
  sanitizeGroundingArtifacts,
  toCanonicalExpressionKey,
  toLinguisticCacheDocId,
} from './linguisticNormalizer';
import {
  fetchVerifiedPhoneticsForTerm,
  getCardPhonetics,
} from './phonetics';

export { LinguisticOfflineError, isAbortError, isLinguisticOfflineError };

export interface AutoFillResult {
  term: string;
  enAlternatives?: string[];
  category: TopicFolder;
  subtopic: SubtopicKey;
  literal: string;
  phoneticUs: string;
  phoneticUk: string;
  ukNote?: string;
  colloquial: string[];
  exampleEn: string;
  examplePt: string;
  exampleEn2: string;
  examplePt2: string;
  tip: string;
  sourceLabel: string;
  isValidForGlobalSchoolDeck?: boolean;
  groundingSources?: { uri: string; title?: string }[];
}

export type TripleCheckStage = 'idle' | 1 | 2 | 3 | 4 | 'done' | 'blocked';

export interface GeneratedSentenceResult {
  exampleEn: string;
  examplePt: string;
  sourceLabel: string;
  contextTip?: string;
  score?: number;
  groundingSources?: { uri: string; title?: string }[];
}

export function naturalizePortugueseSentence(ptText: string): string {
  if (!ptText) return '';
  let s = sanitizeGroundingArtifacts(ptText)
    .replace(/^["“'→\s]+|["”']$/g, '')
    .trim();
  if (s && !/[.!?]["']?$/.test(s)) s += '.';
  return s;
}

async function fetchGeminiLookupCard(
  input: string,
  direction: 'en-to-pt' | 'pt-to-en',
  parentSignal?: AbortSignal
): Promise<AutoFillResult | null> {
  if (!getNetworkSnapshot().connected) return null;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(), 16000);

  try {
    const resp = await fetch('/api/gemini/lookup-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, direction }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.success && data.card) {
      const c = data.card;
      const cleanTerm = sanitizeGroundingArtifacts(c.term || input);
      const cleanLiteral = sanitizeGroundingArtifacts(c.literal || '');
      const cleanEx1En = formatCleanExampleSentence(c.exampleEn || '');
      const cleanEx1Pt = naturalizePortugueseSentence(c.examplePt || '');
      const cleanEx2En = formatCleanExampleSentence(c.exampleEn2 || cleanEx1En);
      const cleanEx2Pt = naturalizePortugueseSentence(c.examplePt2 || cleanEx1Pt);

      if (!cleanTerm || !cleanLiteral || !cleanEx1En || !cleanEx1Pt) {
        return null;
      }

      const fallbackCategory = classifyTermIntoFolder(cleanTerm);
      const category = normalizeOfficialFolder(c.category, fallbackCategory);
      const subtopic = normalizeOfficialSubtopic(
        c.subtopic,
        classifyCardSubtopic({
          term: cleanTerm,
          literal: cleanLiteral,
          exampleEn: cleanEx1En,
        })
      );

      return {
        term: cleanTerm,
        category,
        subtopic,
        literal: cleanLiteral,
        phoneticUs: sanitizeGroundingArtifacts(c.phoneticUs || ''),
        phoneticUk: sanitizeGroundingArtifacts(c.phoneticUk || ''),
        ukNote: sanitizeGroundingArtifacts(c.ukNote || '') || undefined,
        colloquial:
          Array.isArray(c.colloquial) && c.colloquial.length > 0
            ? c.colloquial.map((x: unknown) => sanitizeGroundingArtifacts(x)).filter(Boolean)
            : [cleanLiteral],
        exampleEn: cleanEx1En,
        examplePt: cleanEx1Pt,
        exampleEn2: cleanEx2En || cleanEx1En,
        examplePt2: cleanEx2Pt || cleanEx1Pt,
        tip: sanitizeGroundingArtifacts(c.tip || ''),
        sourceLabel: 'Motor Determinístico Gemini (temperature: 0.0)',
        isValidForGlobalSchoolDeck: Boolean(c.isValidForGlobalSchoolDeck),
        groundingSources: data.groundingSources,
      };
    }
  } catch (err) {
    if (parentSignal?.aborted) {
      throw err;
    }
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onAbort);
  }
  return null;
}

/**
 * Generates a fresh, authentic English + Brazilian Portuguese example sentence pair
 * strictly containing the target expression (or legitimate inflection).
 * Supports `AbortSignal` to eliminate race conditions and NEVER invents synthetic templates.
 */
export async function generateNewExampleSentence(
  term: string,
  currentExamples: string[] = [],
  slot = 1,
  category = 'Frases',
  literal = '',
  options?: { signal?: AbortSignal }
): Promise<GeneratedSentenceResult> {
  const cleanTerm = term.trim();
  if (!cleanTerm) {
    throw new Error('Informe a expressão antes de gerar uma nova frase.');
  }

  const parentSignal = options?.signal;
  if (parentSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const existingNormalized = currentExamples
    .map((e) => e.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  // 1. Primary: Deterministic Gemini `temperature: 0.0` endpoint
  if (getNetworkSnapshot().connected) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    parentSignal?.addEventListener('abort', onAbort, { once: true });
    const timer = globalThis.setTimeout(() => controller.abort(), 16000);

    try {
      const resp = await fetch('/api/gemini/generate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: cleanTerm,
          currentExamples,
          slot,
          category,
          literal,
        }),
        signal: controller.signal,
      });

      if (resp.ok) {
        const data = await resp.json();
        const exEn = formatCleanExampleSentence(data?.exampleEn || '');
        const exPt = naturalizePortugueseSentence(data?.examplePt || '');

        if (
          data?.success &&
          exEn &&
          exPt &&
          doesSentenceContainExpression(exEn, cleanTerm)
        ) {
          return {
            exampleEn: exEn,
            examplePt: exPt,
            sourceLabel: 'Gemini Determinístico (temperature: 0.0)',
            contextTip: sanitizeGroundingArtifacts(data.contextTip || '') || undefined,
            groundingSources: data.groundingSources,
          };
        }
      }
    } catch (err) {
      if (parentSignal?.aborted) {
        throw err;
      }
    } finally {
      globalThis.clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onAbort);
    }
  }

  if (parentSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // 2. Offline / Unreachable fallback: ONLY authentic human-curated pairs from INITIAL_CARDS / KB
  const canonical = toCanonicalExpressionKey(cleanTerm);
  const curatedCandidates: { en: string; pt: string }[] = [];

  for (const seed of INITIAL_CARDS) {
    if (toCanonicalExpressionKey(seed.term) === canonical) {
      if (seed.exampleEn && seed.examplePt) {
        curatedCandidates.push({ en: seed.exampleEn, pt: seed.examplePt });
      }
      const sec = getCardSecondExample(seed);
      if (sec.en && sec.pt) {
        curatedCandidates.push({ en: sec.en, pt: sec.pt });
      }
    }
  }

  const kbEntry = AI_COLLOQUIAL_KB[canonical];
  if (kbEntry) {
    if (kbEntry.exampleEn && kbEntry.examplePt) {
      curatedCandidates.push({ en: kbEntry.exampleEn, pt: kbEntry.examplePt });
    }
    if (kbEntry.exampleEn2 && kbEntry.examplePt2) {
      curatedCandidates.push({ en: kbEntry.exampleEn2, pt: kbEntry.examplePt2 });
    }
  }

  for (const pair of curatedCandidates) {
    const norm = pair.en.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!existingNormalized.includes(norm) && doesSentenceContainExpression(pair.en, cleanTerm)) {
      return {
        exampleEn: formatCleanExampleSentence(pair.en),
        examplePt: naturalizePortugueseSentence(pair.pt),
        sourceLabel: 'Acervo Curado EWM',
      };
    }
  }

  throw new LinguisticOfflineError(
    'Sem conexão no momento para gerar uma nova frase autêntica. Verifique sua internet e tente novamente.'
  );
}

/**
 * Smart Card Lookup (Supports both EN and PT single-input queries, L1 IndexedDB cache,
 * `AbortSignal` cancellation, and honest offline reconnection state with zero synthetic templates).
 */
export async function lookupSmartCardContent(
  inputRaw: string,
  direction: 'en-to-pt' | 'pt-to-en' | 'auto',
  existingCards: Flashcard[],
  onStage?: (stage: TripleCheckStage, message: string) => void,
  options?: { signal?: AbortSignal }
): Promise<AutoFillResult | null> {
  const clean = inputRaw.trim();
  if (!clean) return null;

  const parentSignal = options?.signal;
  if (parentSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const resolvedDirection: 'en-to-pt' | 'pt-to-en' =
    direction === 'auto'
      ? detectInputLanguagePtOrEn(clean) === 'pt'
        ? 'pt-to-en'
        : 'en-to-pt'
      : direction;

  onStage?.(1, 'Analisando expressão e contexto idiomático...');

  // 1. Fast L1 IndexedDB check if previously consulted via Super-Barra
  const cacheId = toLinguisticCacheDocId('consult', clean);
  const cachedConsult = await getLinguisticCacheLocal(cacheId);
  if (parentSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (cachedConsult?.result && cachedConsult.result.mode === 'CONSULT_TRANSLATE') {
    const r = cachedConsult.result;
    const ex1 = r.examples[0];
    const ex2 = r.examples[1] || r.examples[0];
    if (r.englishExpression && r.primaryTranslation && ex1?.en && ex1?.pt) {
      onStage?.('done', 'Carregado instantaneamente do cache local EWM');
      return {
        term: r.englishExpression,
        category: r.suggestedCategory,
        subtopic: r.suggestedSubtopic,
        literal: r.primaryTranslation,
        phoneticUs: r.phoneticUs || '',
        phoneticUk: r.phoneticUk || '',
        ukNote: r.usUkDifferences || undefined,
        colloquial:
          r.colloquialPtList.length > 0 ? r.colloquialPtList : [r.primaryTranslation],
        exampleEn: formatCleanExampleSentence(ex1.en),
        examplePt: naturalizePortugueseSentence(ex1.pt),
        exampleEn2: formatCleanExampleSentence(ex2.en),
        examplePt2: naturalizePortugueseSentence(ex2.pt),
        tip: r.pedagogicalTip || r.falseCognateOrLiteralWarning || '',
        sourceLabel: 'Cache Local Instantâneo (L1)',
        isValidForGlobalSchoolDeck: r.isValidForGlobalSchoolDeck,
      };
    }
  }

  // 2. Primary Online Engine: Gemini `temperature: 0.0` + Strict Schema
  const geminiResult = await fetchGeminiLookupCard(clean, resolvedDirection, parentSignal);
  if (parentSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (geminiResult && geminiResult.exampleEn && geminiResult.examplePt) {
    onStage?.(2, 'Validando pronúncia US & UK e organização...');
    const verifiedPhon =
      !geminiResult.phoneticUs || !geminiResult.phoneticUk
        ? await fetchVerifiedPhoneticsForTerm(geminiResult.term)
        : { phoneticUs: '', phoneticUk: '', ukNote: undefined };

    if (parentSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let finalExEn = geminiResult.exampleEn;
    let finalExPt = geminiResult.examplePt;
    if (!doesSentenceContainExpression(finalExEn, geminiResult.term)) {
      try {
        const regen = await generateNewExampleSentence(
          geminiResult.term,
          [],
          1,
          geminiResult.category,
          geminiResult.literal,
          { signal: parentSignal }
        );
        finalExEn = regen.exampleEn;
        finalExPt = regen.examplePt;
      } catch (err) {
        if (isAbortError(err)) throw err;
      }
    }

    onStage?.('done', 'Preenchido com precisão nativa (US & UK)');

    return {
      ...geminiResult,
      phoneticUs: geminiResult.phoneticUs || verifiedPhon.phoneticUs || '',
      phoneticUk: geminiResult.phoneticUk || verifiedPhon.phoneticUk || '',
      ukNote: geminiResult.ukNote || verifiedPhon.ukNote,
      exampleEn: finalExEn,
      examplePt: finalExPt,
    };
  }

  // 3. Curated Human-Verified Offline Lexicon ONLY (never synthetic templates!)
  const lowerPt = clean.toLowerCase().replace(/[.!?]+$/, '').trim();
  const canonicalEn = toCanonicalExpressionKey(clean);

  // 3a. Curated PT -> EN KB
  if (resolvedDirection === 'pt-to-en') {
    const ptEntry = AI_PT_TO_EN_KB[lowerPt];
    if (ptEntry && ptEntry.exampleEn && ptEntry.examplePt) {
      const targetPtTerm = ptEntry.term || clean;
      const localPhon = getCardPhonetics({
        id: '',
        term: targetPtTerm,
        literal: ptEntry.literal,
      });
      onStage?.('done', 'Carregado do Acervo Curado EWM');
      return {
        term: targetPtTerm,
        enAlternatives: ptEntry.enAlternatives || [],
        category: classifyTermIntoFolder(targetPtTerm),
        subtopic: classifyCardSubtopic({
          term: targetPtTerm,
          literal: ptEntry.literal,
          exampleEn: ptEntry.exampleEn,
          subtopic: ptEntry.subtopic as SubtopicKey,
        }),
        literal: localPhon.meaning || ptEntry.literal,
        phoneticUs: localPhon.us,
        phoneticUk: localPhon.uk,
        ukNote: localPhon.ukNote || undefined,
        colloquial: ptEntry.colloquial,
        exampleEn: formatCleanExampleSentence(ptEntry.exampleEn),
        examplePt: naturalizePortugueseSentence(ptEntry.examplePt),
        exampleEn2: formatCleanExampleSentence(ptEntry.exampleEn2 || ptEntry.exampleEn),
        examplePt2: naturalizePortugueseSentence(ptEntry.examplePt2 || ptEntry.examplePt),
        tip: ptEntry.tip,
        sourceLabel: 'Acervo Curado EWM (Offline)',
        isValidForGlobalSchoolDeck: false,
      };
    }

    for (const [enKey, kbVal] of Object.entries(AI_COLLOQUIAL_KB)) {
      const joinedCols = (kbVal.colloquial || []).join(' ').toLowerCase();
      if (
        (joinedCols.includes(lowerPt) || kbVal.literal.toLowerCase() === lowerPt) &&
        kbVal.exampleEn &&
        kbVal.examplePt
      ) {
        const formattedTerm = kbVal.term || enKey.charAt(0).toUpperCase() + enKey.slice(1);
        const localPhon = getCardPhonetics({
          id: '',
          term: formattedTerm,
          literal: kbVal.literal,
        });
        onStage?.('done', 'Carregado do Acervo Curado EWM');
        return {
          term: formattedTerm,
          category: classifyTermIntoFolder(formattedTerm),
          subtopic: classifyCardSubtopic({
            term: formattedTerm,
            literal: kbVal.literal,
            exampleEn: kbVal.exampleEn,
            subtopic: kbVal.subtopic as SubtopicKey,
          }),
          literal: localPhon.meaning || kbVal.literal,
          phoneticUs: localPhon.us,
          phoneticUk: localPhon.uk,
          ukNote: localPhon.ukNote || undefined,
          colloquial: kbVal.colloquial,
          exampleEn: formatCleanExampleSentence(kbVal.exampleEn),
          examplePt: naturalizePortugueseSentence(kbVal.examplePt),
          exampleEn2: formatCleanExampleSentence(kbVal.exampleEn2 || kbVal.exampleEn),
          examplePt2: naturalizePortugueseSentence(kbVal.examplePt2 || kbVal.examplePt),
          tip: kbVal.tip,
          sourceLabel: 'Acervo Curado EWM (Offline)',
          isValidForGlobalSchoolDeck: false,
        };
      }
    }
  }

  // 3b. Existing / Seed Cards
  const matchExisting = [...existingCards, ...INITIAL_CARDS].find(
    (c) =>
      toCanonicalExpressionKey(c.term) === canonicalEn ||
      normalizePhrasalLookupKey(c.term) === normalizePhrasalLookupKey(clean)
  );
  if (matchExisting && matchExisting.exampleEn && matchExisting.examplePt) {
    const sec = getCardSecondExample(matchExisting);
    const phon = getCardPhonetics(matchExisting);
    onStage?.('done', 'Carregado do Acervo Local EWM');
    return {
      term: matchExisting.term,
      category: matchExisting.category,
      subtopic: matchExisting.subtopic,
      literal: phon.meaning || matchExisting.literal,
      phoneticUs: phon.us,
      phoneticUk: phon.uk,
      ukNote: phon.ukNote || undefined,
      colloquial:
        matchExisting.colloquial.length > 0
          ? matchExisting.colloquial
          : [matchExisting.literal],
      exampleEn: formatCleanExampleSentence(matchExisting.exampleEn),
      examplePt: naturalizePortugueseSentence(matchExisting.examplePt),
      exampleEn2: formatCleanExampleSentence(sec.en),
      examplePt2: naturalizePortugueseSentence(sec.pt),
      tip: matchExisting.tip,
      sourceLabel: 'Acervo Local EWM',
      isValidForGlobalSchoolDeck: false,
    };
  }

  // 3c. Curated EN Colloquial KB
  const kbEntry = AI_COLLOQUIAL_KB[canonicalEn] || AI_COLLOQUIAL_KB[normalizePhrasalLookupKey(clean)];
  if (kbEntry && kbEntry.exampleEn && kbEntry.examplePt) {
    const formattedTerm = kbEntry.term || clean.charAt(0).toUpperCase() + clean.slice(1);
    const localPhon = getCardPhonetics({
      id: '',
      term: formattedTerm,
      literal: kbEntry.literal,
    });
    onStage?.('done', 'Carregado do Acervo Curado EWM');
    return {
      term: formattedTerm,
      category: classifyTermIntoFolder(formattedTerm),
      subtopic: classifyCardSubtopic({
        term: formattedTerm,
        literal: kbEntry.literal,
        exampleEn: kbEntry.exampleEn,
        subtopic: kbEntry.subtopic as SubtopicKey,
      }),
      literal: localPhon.meaning || kbEntry.literal,
      phoneticUs: localPhon.us,
      phoneticUk: localPhon.uk,
      ukNote: localPhon.ukNote || undefined,
      colloquial: kbEntry.colloquial.length > 0 ? kbEntry.colloquial : [kbEntry.literal],
      exampleEn: formatCleanExampleSentence(kbEntry.exampleEn),
      examplePt: naturalizePortugueseSentence(kbEntry.examplePt),
      exampleEn2: formatCleanExampleSentence(kbEntry.exampleEn2 || kbEntry.exampleEn),
      examplePt2: naturalizePortugueseSentence(kbEntry.examplePt2 || kbEntry.examplePt),
      tip: kbEntry.tip,
      sourceLabel: 'Acervo Curado EWM (Offline)',
      isValidForGlobalSchoolDeck: false,
    };
  }

  // Honest offline reconnection state — never invent synthetic fallback sentences
  throw new LinguisticOfflineError(
    'Sem conexão com o motor de IA neste momento. Verifique sua rede e tente novamente ou preencha os campos manualmente.'
  );
}
