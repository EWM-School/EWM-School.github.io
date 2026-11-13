import { AI_COLLOQUIAL_KB, AI_PT_TO_EN_KB, INITIAL_CARDS } from '../data/seedData';
import type { Flashcard, SubtopicKey, TopicFolder } from '../types/flashcard';
import {
  classifyCardSubtopic,
  classifyTermIntoFolder,
  getCardSecondExample,
} from '../utils/deckHelpers';
import {
  classifyLinguisticIntent,
  doesSentenceContainExpression,
  enforceDeterministicGrammarVerdict,
  formatCleanExampleSentence,
  normalizeOfficialFolder,
  normalizeOfficialSubtopic,
  sanitizeGroundingArtifacts,
  toCanonicalCardId,
  toCanonicalExpressionKey,
  toLinguisticCacheDocId,
  validateInvisibleTeacherCuratorship,
  type ConsultTranslatePayload,
  type GrammarCheckPayload,
  type LinguisticEngineResult,
} from '../utils/linguisticNormalizer';
import { getCardPhonetics } from '../utils/phonetics';
import { fetchCollectiveLinguisticCacheFromCloud } from './firebase';
import { getNetworkSnapshot } from './sync/networkMonitor';
import { getLinguisticCacheLocal, putLinguisticCacheLocal } from './sync/offlineStorage';
import { recordLinguisticCacheOptimistic } from './sync/syncEngine';

export class LinguisticOfflineError extends Error {
  readonly code = 'OFFLINE_RECONNECT' as const;

  constructor(
    message = 'Sem conexão com o motor linguístico neste momento. Verifique sua internet e tente novamente.'
  ) {
    super(message);
    this.name = 'LinguisticOfflineError';
  }
}

export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  const name = String((err as { name?: string })?.name || '');
  return name === 'AbortError';
}

export function isLinguisticOfflineError(err: unknown): err is LinguisticOfflineError {
  return (
    err instanceof LinguisticOfflineError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'OFFLINE_RECONNECT')
  );
}

/**
 * Curated Offline Lexicon Lookup (L1 Fallback ONLY for known curated expressions when offline).
 * Never invents synthetic sentences and never runs for GRAMMAR_CHECK.
 */
function lookupCuratedOfflineConsult(
  rawQuery: string,
  localCards: Flashcard[]
): ConsultTranslatePayload | null {
  const clean = rawQuery.trim();
  if (!clean) return null;

  const canonical = toCanonicalExpressionKey(clean);
  const lowerPt = clean.toLowerCase().replace(/[.!?]+$/, '').trim();

  // 1. Direct match in user/global/seed Flashcards
  const allCurated = [...localCards, ...INITIAL_CARDS];
  const cardMatch = allCurated.find(
    (c) =>
      toCanonicalExpressionKey(c.term) === canonical ||
      c.literal.toLowerCase().trim() === lowerPt
  );

  if (cardMatch && cardMatch.exampleEn && cardMatch.examplePt) {
    const phon = getCardPhonetics(cardMatch);
    const sec = getCardSecondExample(cardMatch);
    const exprCanonical = toCanonicalExpressionKey(cardMatch.term);
    const meaningPt = phon.meaning || cardMatch.literal;

    return {
      mode: 'CONSULT_TRANSLATE',
      query: clean,
      sourceLanguage: toCanonicalExpressionKey(cardMatch.term) === canonical ? 'en' : 'pt',
      canonicalKey: exprCanonical,
      englishExpression: cardMatch.term,
      primaryTranslation: meaningPt,
      contextualNuances: [
        {
          expressionEn: cardMatch.term,
          meaningPt,
          whenToUsePt:
            cardMatch.tip ||
            `Uso natural em situações de ${cardMatch.subtopic.toLowerCase()}.`,
          exampleEn: cardMatch.exampleEn,
          examplePt: cardMatch.examplePt,
        },
      ],
      usUkDifferences:
        phon.ukNote ||
        cardMatch.ukNote ||
        'Uso natural equivalente nos EUA e no Reino Unido (diferença principal na pronúncia).',
      phoneticUs: phon.us || cardMatch.phoneticUs || '',
      phoneticUk: phon.uk || cardMatch.phoneticUk || '',
      examples: [
        { en: cardMatch.exampleEn, pt: cardMatch.examplePt },
        { en: sec.en || cardMatch.exampleEn, pt: sec.pt || cardMatch.examplePt },
      ],
      falseCognateOrLiteralWarning: '',
      isValidForGlobalSchoolDeck: false,
      suggestedCategory: cardMatch.category,
      suggestedSubtopic: cardMatch.subtopic,
      colloquialPtList:
        cardMatch.colloquial.length > 0 ? cardMatch.colloquial : [meaningPt],
      pedagogicalTip: cardMatch.tip || '',
      cacheLayer: 'L1_OFFLINE_LEXICON',
    };
  }

  // 2. Match in curated PT -> EN knowledge base
  const ptKb = AI_PT_TO_EN_KB[lowerPt];
  if (ptKb && ptKb.exampleEn && ptKb.examplePt) {
    const resolvedPtTerm = ptKb.term || clean;
    const phon = getCardPhonetics({ id: '', term: resolvedPtTerm, literal: ptKb.literal });
    const exprCanonical = toCanonicalExpressionKey(resolvedPtTerm);
    const cat = classifyTermIntoFolder(resolvedPtTerm);
    const sub = classifyCardSubtopic({
      term: resolvedPtTerm,
      literal: ptKb.literal,
      exampleEn: ptKb.exampleEn,
      subtopic: ptKb.subtopic as SubtopicKey,
    });

    return {
      mode: 'CONSULT_TRANSLATE',
      query: clean,
      sourceLanguage: 'pt',
      canonicalKey: exprCanonical,
      englishExpression: resolvedPtTerm,
      primaryTranslation: phon.meaning || ptKb.literal,
      contextualNuances: [
        {
          expressionEn: resolvedPtTerm,
          meaningPt: phon.meaning || ptKb.literal,
          whenToUsePt: ptKb.tip || 'Equivalente idiomático mais natural usado por nativos.',
          exampleEn: ptKb.exampleEn,
          examplePt: ptKb.examplePt,
        },
        ...(ptKb.enAlternatives || []).slice(0, 2).map((alt) => ({
          expressionEn: alt,
          meaningPt: phon.meaning || ptKb.literal,
          whenToUsePt: 'Variação contextual natural usada no dia a dia.',
          exampleEn: ptKb.exampleEn2 || ptKb.exampleEn,
          examplePt: ptKb.examplePt2 || ptKb.examplePt,
        })),
      ],
      usUkDifferences:
        phon.ukNote ||
        'Expressão compreendida naturalmente nos EUA e no Reino Unido.',
      phoneticUs: phon.us || '',
      phoneticUk: phon.uk || '',
      examples: [
        { en: ptKb.exampleEn, pt: ptKb.examplePt },
        {
          en: ptKb.exampleEn2 || ptKb.exampleEn,
          pt: ptKb.examplePt2 || ptKb.examplePt,
        },
      ],
      falseCognateOrLiteralWarning:
        'Evite traduzir palavra por palavra; prefira a construção idiomática acima.',
      isValidForGlobalSchoolDeck: false,
      suggestedCategory: cat,
      suggestedSubtopic: sub,
      colloquialPtList: ptKb.colloquial || [ptKb.literal],
      pedagogicalTip: ptKb.tip || '',
      cacheLayer: 'L1_OFFLINE_LEXICON',
    };
  }

  // 3. Match in curated EN colloquial KB
  const enKb = AI_COLLOQUIAL_KB[canonical];
  if (enKb && enKb.exampleEn && enKb.examplePt) {
    const formattedTerm = enKb.term || clean.charAt(0).toUpperCase() + clean.slice(1);
    const phon = getCardPhonetics({ id: '', term: formattedTerm, literal: enKb.literal });
    const cat = classifyTermIntoFolder(formattedTerm);
    const sub = classifyCardSubtopic({
      term: formattedTerm,
      literal: enKb.literal,
      exampleEn: enKb.exampleEn,
      subtopic: enKb.subtopic as SubtopicKey,
    });

    return {
      mode: 'CONSULT_TRANSLATE',
      query: clean,
      sourceLanguage: 'en',
      canonicalKey: canonical,
      englishExpression: formattedTerm,
      primaryTranslation: phon.meaning || enKb.literal,
      contextualNuances: [
        {
          expressionEn: formattedTerm,
          meaningPt: phon.meaning || enKb.literal,
          whenToUsePt: enKb.tip || 'Uso idiomático frequente entre falantes nativos.',
          exampleEn: enKb.exampleEn,
          examplePt: enKb.examplePt,
        },
      ],
      usUkDifferences:
        phon.ukNote ||
        'Expressão usada tanto no inglês americano quanto no britânico.',
      phoneticUs: phon.us || '',
      phoneticUk: phon.uk || '',
      examples: [
        { en: enKb.exampleEn, pt: enKb.examplePt },
        {
          en: enKb.exampleEn2 || enKb.exampleEn,
          pt: enKb.examplePt2 || enKb.examplePt,
        },
      ],
      falseCognateOrLiteralWarning: '',
      isValidForGlobalSchoolDeck: false,
      suggestedCategory: cat,
      suggestedSubtopic: sub,
      colloquialPtList: enKb.colloquial || [enKb.literal],
      pedagogicalTip: enKb.tip || '',
      cacheLayer: 'L1_OFFLINE_LEXICON',
    };
  }

  return null;
}

/**
 * 3-Layer Deterministic Linguistic Pipeline:
 * - L1: IndexedDB local cache (`0ms`, offline-ready)
 * - L2: Collective Firestore cache (`/linguisticCache/{cacheId}`)
 * - L3: Gemini `temperature: 0.0` + strict JSON Schema (`POST /api/gemini/linguistic-engine`)
 */
export async function queryLinguisticEngineHybrid(params: {
  query: string;
  modeOverride?: 'auto' | 'consult' | 'grammar';
  localCards?: Flashcard[];
  signal?: AbortSignal;
}): Promise<LinguisticEngineResult> {
  const cleanQuery = String(params.query || '').trim();
  if (!cleanQuery) {
    throw new Error('Digite uma expressão ou frase para consultar.');
  }

  const intent = classifyLinguisticIntent(cleanQuery, params.modeOverride ?? 'auto');
  const cacheMode = intent.mode === 'GRAMMAR_CHECK' ? 'grammar' : 'consult';
  const cacheId = toLinguisticCacheDocId(cacheMode, cleanQuery);

  // LAYER 1: Local IndexedDB (`0ms`)
  const localHit = await getLinguisticCacheLocal(cacheId);
  if (params.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (localHit?.result) {
    if (localHit.result.mode === 'GRAMMAR_CHECK') {
      const checked: GrammarCheckPayload = {
        ...localHit.result,
        verdict: enforceDeterministicGrammarVerdict({
          detectedErrors: localHit.result.detectedErrors,
          isStiltedOrTruncated: localHit.result.isStiltedOrTruncated,
          rawVerdict: localHit.result.verdict,
        }),
        cacheLayer: 'L1_INDEXEDDB',
      };
      return checked;
    }
    return {
      ...localHit.result,
      cacheLayer: 'L1_INDEXEDDB',
    };
  }

  // LAYER 2: Collective Firestore Cache (shared across students)
  if (getNetworkSnapshot().connected) {
    const cloudHit = await fetchCollectiveLinguisticCacheFromCloud(cacheId);
    if (params.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (cloudHit) {
      const nowIso = new Date().toISOString();
      const toStore: LinguisticEngineResult = { ...cloudHit };
      delete toStore.cacheLayer;
      void putLinguisticCacheLocal({
        cacheKey: cacheId,
        canonicalKey:
          cloudHit.mode === 'CONSULT_TRANSLATE'
            ? cloudHit.canonicalKey || toCanonicalExpressionKey(cleanQuery)
            : cleanQuery.toLowerCase(),
        mode: cloudHit.mode,
        result: toStore,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        ...cloudHit,
        cacheLayer: 'L2_FIRESTORE',
      };
    }
  }

  // LAYER 3: Gemini `temperature: 0.0` via `/api/gemini/linguistic-engine`
  if (getNetworkSnapshot().connected) {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    params.signal?.addEventListener('abort', onParentAbort, { once: true });
    const timeoutId = window.setTimeout(() => controller.abort(), 18000);

    try {
      const resp = await fetch('/api/gemini/linguistic-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: cleanQuery,
          query: cleanQuery,
          modeOverride: params.modeOverride ?? 'auto',
        }),
        signal: controller.signal,
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          success?: boolean;
          result?: LinguisticEngineResult;
        };

        if (data?.success && data.result) {
          let finalResult: LinguisticEngineResult;
          let canonicalKeyForCache: string;

          if (data.result.mode === 'GRAMMAR_CHECK') {
            finalResult = {
              ...data.result,
              verdict: enforceDeterministicGrammarVerdict({
                detectedErrors: data.result.detectedErrors,
                isStiltedOrTruncated: data.result.isStiltedOrTruncated,
                rawVerdict: data.result.verdict,
              }),
              cacheLayer: 'L3_GEMINI',
            };
            canonicalKeyForCache = cleanQuery.toLowerCase().slice(0, 180);
          } else {
            const canonical =
              toCanonicalExpressionKey(data.result.englishExpression) ||
              toCanonicalExpressionKey(data.result.canonicalKey) ||
              toCanonicalExpressionKey(cleanQuery);
            finalResult = {
              ...data.result,
              canonicalKey: canonical,
              suggestedCategory: normalizeOfficialFolder(data.result.suggestedCategory, 'Frases'),
              suggestedSubtopic: normalizeOfficialSubtopic(
                data.result.suggestedSubtopic,
                'Casual'
              ),
              cacheLayer: 'L3_GEMINI',
            };
            canonicalKeyForCache = canonical;
          }

          void recordLinguisticCacheOptimistic({
            cacheId,
            canonicalKey: canonicalKeyForCache,
            result: finalResult,
          });

          return finalResult;
        }
      }
    } catch (err) {
      if (params.signal?.aborted) {
        throw err;
      }
      // Network/timeout failure falls through to curated offline check or honest reconnect error
    } finally {
      window.clearTimeout(timeoutId);
      params.signal?.removeEventListener('abort', onParentAbort);
    }
  }

  if (params.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Offline / Unreachable: ONLY serve curated human-verified lexicon for CONSULT_TRANSLATE (NEVER synthetic templates, NEVER grammar approval by omission)
  if (intent.mode === 'CONSULT_TRANSLATE') {
    const offlineLexiconHit = lookupCuratedOfflineConsult(cleanQuery, params.localCards ?? []);
    if (offlineLexiconHit) {
      return offlineLexiconHit;
    }
  }

  throw new LinguisticOfflineError(
    intent.mode === 'GRAMMAR_CHECK'
      ? 'A revisão gramatical C2 exige conexão ativa para garantir zero falso positivo. Reconecte-se e tente novamente.'
      : 'Sem conexão com o motor linguístico e esta expressão ainda não está salva no seu aparelho. Reconecte-se e tente novamente.'
  );
}

export interface AutoFeedCandidateInput {
  englishExpression: string;
  primaryTranslation: string;
  category: TopicFolder;
  subtopic: SubtopicKey;
  phoneticUs?: string;
  phoneticUk?: string;
  ukNote?: string;
  colloquial?: string[];
  exampleEn: string;
  examplePt: string;
  exampleEn2?: string;
  examplePt2?: string;
  tip?: string;
  isValidForGlobalSchoolDeck: boolean;
}

/**
 * Enforces Invisible Guards 1 & 2 before constructing a new global card for "Acervo Completo EWM":
 * 1. "Professor Invisível" curatorship (`validateInvisibleTeacherCuratorship`)
 * 2. Canonical Anti-Duplicate Normalization (`"to hang up"`, `"Hang up!"`, `"HANG UP"` -> `"hang up"`)
 * Returns `null` if rejected by curatorship or if canonical key already exists in the school deck.
 */
export function buildCuratedGlobalSchoolCard(
  candidate: AutoFeedCandidateInput,
  existingSchoolCards: Flashcard[]
): { card: Flashcard; canonicalKey: string } | null {
  const cleanTerm = sanitizeGroundingArtifacts(candidate.englishExpression);
  const canonicalKey = toCanonicalExpressionKey(cleanTerm);
  if (!canonicalKey) return null;

  const category = normalizeOfficialFolder(
    candidate.category,
    classifyTermIntoFolder(cleanTerm)
  );
  const subtopic = normalizeOfficialSubtopic(
    candidate.subtopic,
    classifyCardSubtopic({
      term: cleanTerm,
      literal: candidate.primaryTranslation,
      exampleEn: candidate.exampleEn,
    })
  );

  const cleanEx1En = formatCleanExampleSentence(candidate.exampleEn);
  const cleanEx1Pt = sanitizeGroundingArtifacts(candidate.examplePt);
  const cleanEx2En = candidate.exampleEn2
    ? formatCleanExampleSentence(candidate.exampleEn2)
    : cleanEx1En;
  const cleanEx2Pt = candidate.examplePt2
    ? sanitizeGroundingArtifacts(candidate.examplePt2)
    : cleanEx1Pt;

  // Guard 1: "Professor Invisível"
  const passedCuratorship = validateInvisibleTeacherCuratorship({
    aiApproved: candidate.isValidForGlobalSchoolDeck,
    englishExpression: cleanTerm,
    primaryTranslation: candidate.primaryTranslation,
    exampleEn: cleanEx1En,
    examplePt: cleanEx1Pt,
    category,
    subtopic,
  });

  if (!passedCuratorship) {
    return null;
  }

  // Guard 2: Canonical Anti-Duplicate against Seed + Global Catalog
  const allOfficial = [...INITIAL_CARDS, ...existingSchoolCards];
  const alreadyExists = allOfficial.some(
    (c) => !c.archived && toCanonicalExpressionKey(c.term) === canonicalKey
  );
  if (alreadyExists) {
    return null;
  }

  const displayTerm = cleanTerm.charAt(0).toUpperCase() + cleanTerm.slice(1);
  const cleanLiteral = sanitizeGroundingArtifacts(candidate.primaryTranslation);
  const colloquialList = (candidate.colloquial || [])
    .map((x) => sanitizeGroundingArtifacts(x))
    .filter(Boolean)
    .slice(0, 5);
  if (colloquialList.length === 0) {
    colloquialList.push(cleanLiteral);
  }

  const finalEx2En = doesSentenceContainExpression(cleanEx2En, canonicalKey)
    ? cleanEx2En
    : cleanEx1En;
  const finalEx2Pt = doesSentenceContainExpression(cleanEx2En, canonicalKey)
    ? cleanEx2Pt
    : cleanEx1Pt;

  const card: Flashcard = {
    id: toCanonicalCardId(canonicalKey),
    term: displayTerm,
    category,
    subtopic,
    literal: cleanLiteral,
    phoneticUs: sanitizeGroundingArtifacts(candidate.phoneticUs || '') || undefined,
    phoneticUk: sanitizeGroundingArtifacts(candidate.phoneticUk || '') || undefined,
    ukNote: sanitizeGroundingArtifacts(candidate.ukNote || '') || undefined,
    colloquial: colloquialList,
    exampleEn: cleanEx1En,
    examplePt: cleanEx1Pt,
    exampleEn2: finalEx2En,
    examplePt2: finalEx2Pt,
    tip:
      sanitizeGroundingArtifacts(candidate.tip || '') ||
      'Expressão integrada automaticamente ao Acervo Completo EWM.',
    status: 'unseen',
    origin: 'global',
    published: true,
    archived: false,
    updatedAt: Date.now(),
  };

  return { card, canonicalKey };
}
