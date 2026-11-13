import type { SubtopicKey, TopicFolder } from '../types/flashcard';
import { getWordFormsRegex } from './grammarEngine.js';

export type LinguisticMode = 'CONSULT_TRANSLATE' | 'GRAMMAR_CHECK';

export type GrammarVerdict =
  | 'PERFECT_NATURAL'
  | 'UNDERSTANDABLE_UNNATURAL'
  | 'INCORRECT';

export interface DetectedGrammarError {
  exactSnippet: string;
  replacementSnippet: string;
  errorType: string;
  explanationPt: string;
}

export interface ContextualNuanceItem {
  expressionEn: string;
  meaningPt: string;
  whenToUsePt: string;
  exampleEn: string;
  examplePt: string;
}

export interface ConsultTranslatePayload {
  mode: 'CONSULT_TRANSLATE';
  query: string;
  sourceLanguage: 'pt' | 'en';
  canonicalKey: string;
  englishExpression: string;
  primaryTranslation: string;
  contextualNuances: ContextualNuanceItem[];
  usUkDifferences: string;
  phoneticUs: string;
  phoneticUk: string;
  examples: { en: string; pt: string }[];
  falseCognateOrLiteralWarning: string;
  isValidForGlobalSchoolDeck: boolean;
  suggestedCategory: TopicFolder;
  suggestedSubtopic: SubtopicKey;
  colloquialPtList: string[];
  pedagogicalTip: string;
  cacheLayer?: 'L1_INDEXEDDB' | 'L2_FIRESTORE' | 'L3_GEMINI' | 'L1_OFFLINE_LEXICON';
}

export interface GrammarCheckPayload {
  mode: 'GRAMMAR_CHECK';
  originalSentence: string;
  detectedErrors: DetectedGrammarError[];
  isStiltedOrTruncated: boolean;
  unnaturalnessNotePt: string;
  correctedNaturalSentence: string;
  alternativeNaturalSentence?: string;
  correctedTranslationPt: string;
  phoneticUs: string;
  phoneticUk: string;
  verdict: GrammarVerdict;
  cacheLayer?: 'L1_INDEXEDDB' | 'L2_FIRESTORE' | 'L3_GEMINI';
}

export type LinguisticEngineResult = ConsultTranslatePayload | GrammarCheckPayload;

export const OFFICIAL_FOLDERS_LIST: readonly TopicFolder[] = [
  'Dicas da Mari',
  'Palavras',
  'Frases',
  'Phrasal Verbs',
  'Outros',
];

export const OFFICIAL_SUBTOPICS_LIST: readonly SubtopicKey[] = [
  'Viagens',
  'Clima',
  'Trabalho',
  'Lazer',
  'Casual',
  'Outros',
];

/**
 * Strips any grounding citations ([1], [cite: ...]), markdown URLs, HTML tags,
 * or stray formatting artifacts while preserving legitimate natural English/Portuguese punctuation.
 */
export function sanitizeGroundingArtifacts(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let s = String(raw);
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  s = s.replace(/<[^>]+>/g, '');
  // Convert markdown links [label](https://...) -> label
  s = s.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, '$1');
  // Remove numeric or cite bracket markers injected by search grounding: [1], [1, 2], [cite: 1]
  s = s.replace(/\[(?:\d+(?:\s*,\s*\d+)*|cite:[^\]]+|source:[^\]]+)\]/gi, '');
  // Remove raw URLs
  s = s.replace(/https?:\/\/\S+/gi, '');
  // Collapse whitespace and trim surrounding quotes
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^["“”'‘’`]+|["“”'‘’`]+$/g, '').trim();
  return s;
}

export function formatCleanExampleSentence(raw: unknown): string {
  let s = sanitizeGroundingArtifacts(raw);
  if (!s) return '';
  // Replace slash-separated inline alternatives like "office / workplace" with the first natural choice
  s = s.replace(/\b([A-Za-z']+)\s*\/\s*([A-Za-z']+)\b/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]["']?$/.test(s)) {
    s += '.';
  }
  return s;
}

/**
 * Canonical Anti-Duplicate Normalization:
 * "to hang up", "Hang up!", and "HANG UP" all map deterministically to "hang up".
 */
export function toCanonicalExpressionKey(rawInput: string): string {
  if (!rawInput) return '';
  let k = String(rawInput)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[’‘`]/g, "'")
    .replace(/^[\s.!?,;:"“”¡¿—–\-]+|[\s.!?,;:"“”¡¿—–\-]+$/g, '')
    .replace(/[.!?,;:"“”¡¿]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading English infinitive marker ("to hang up" -> "hang up")
  k = k.replace(/^to\s+/, '').trim();
  return k;
}

/**
 * Deterministic 32-bit FNV-1a hex hash for collision-free, Firestore-safe document IDs.
 */
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function toCanonicalCardId(canonicalKey: string): string {
  const clean = toCanonicalExpressionKey(canonicalKey);
  const slug = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `ewm_auto_${slug || 'expr'}_${fnv1aHex(clean)}`;
}

export function toLinguisticCacheDocId(
  mode: 'consult' | 'grammar',
  rawQuery: string
): string {
  const normalized =
    mode === 'consult'
      ? toCanonicalExpressionKey(rawQuery)
      : String(rawQuery || '')
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[’‘`]/g, "'")
          .replace(/\s+/g, ' ')
          .trim();

  const slug = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 44);

  return `lc_${mode}_${slug || 'q'}_${fnv1aHex(`${mode}:${normalized}`)}`;
}

/**
 * Hardcoded Mathematical Guard (Zero False Positives):
 * If `detectedErrors.length > 0`, `verdict` is FORCIBLY prevented from being `PERFECT_NATURAL`
 * (overridden to `INCORRECT`).
 */
export function enforceDeterministicGrammarVerdict(params: {
  detectedErrors: DetectedGrammarError[] | undefined | null;
  isStiltedOrTruncated?: boolean;
  rawVerdict?: string | null;
}): GrammarVerdict {
  const validErrors = Array.isArray(params.detectedErrors)
    ? params.detectedErrors.filter(
        (err) =>
          Boolean(
            err &&
              (String(err.exactSnippet || '').trim().length > 0 ||
                String(err.explanationPt || '').trim().length > 0)
          )
      )
    : [];

  if (validErrors.length > 0) {
    return 'INCORRECT';
  }

  if (params.rawVerdict === 'INCORRECT') {
    return 'INCORRECT';
  }

  if (params.isStiltedOrTruncated || params.rawVerdict === 'UNDERSTANDABLE_UNNATURAL') {
    return 'UNDERSTANDABLE_UNNATURAL';
  }

  return 'PERFECT_NATURAL';
}

const PT_DIACRITICS_REGEX = /[ãõçáéíóúâêôàü]/i;

const PT_COMMON_WORDS = new Set([
  'por',
  'enquanto',
  'dar',
  'jeito',
  'como',
  'nao',
  'não',
  'para',
  'pra',
  'pro',
  'com',
  'sem',
  'voce',
  'você',
  'eu',
  'ele',
  'ela',
  'nos',
  'nós',
  'eles',
  'elas',
  'estou',
  'esta',
  'está',
  'tenho',
  'tem',
  'fazer',
  'ficar',
  'dizer',
  'falar',
  'ir',
  'vou',
  'vai',
  'muito',
  'mais',
  'menos',
  'mas',
  'porque',
  'quando',
  'onde',
  'qual',
  'isso',
  'isto',
  'esse',
  'essa',
  'este',
  'meu',
  'minha',
  'seu',
  'sua',
  'gente',
  'hoje',
  'amanha',
  'amanhã',
  'ontem',
  'agora',
  'sempre',
  'nunca',
  'tambem',
  'também',
  'ainda',
  'ja',
  'já',
  'uma',
  'um',
  'uns',
  'umas',
  'dos',
  'das',
  'pelo',
  'pela',
  'num',
  'numa',
  'depois',
  'antes',
  'sobre',
  'entre',
  'ate',
  'até',
  'mesmo',
  'coisa',
  'vez',
  'dia',
  'trabalho',
  'viagem',
  'reuniao',
  'reunião',
  'ingles',
  'inglês',
  'significa',
  'traduzir',
  'traducao',
  'tradução',
  'quer',
  'posso',
  'preciso',
  'quero',
]);

const EN_CLAUSE_STARTERS = new Set([
  'i',
  "i'm",
  "i've",
  "i'd",
  "i'll",
  'you',
  "you're",
  "you've",
  "you'd",
  "you'll",
  'he',
  "he's",
  "he'd",
  "he'll",
  'she',
  "she's",
  "she'd",
  "she'll",
  'it',
  "it's",
  'we',
  "we're",
  "we've",
  "we'd",
  "we'll",
  'they',
  "they're",
  "they've",
  "they'd",
  "they'll",
  "let's",
  'there',
  "there's",
  'this',
  'that',
  'these',
  'those',
  'my',
  'your',
  'his',
  'her',
  'our',
  'their',
  'somebody',
  'someone',
  'everyone',
  'everybody',
  'nobody',
  'anyone',
  'who',
  'what',
  'where',
  'when',
  'why',
  'how',
  'can',
  'could',
  'should',
  'would',
  'will',
  'do',
  'does',
  'did',
  'is',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'please',
]);

const EN_COLLOCATION_ERROR_SNIPPETS =
  /\b(depend(?:s|ed|ing)?\s+of|married\s+with|interested\s+on|arrive(?:s|d|ing)?\s+to|discuss(?:es|ed|ing)?\s+about|explain\s+(?:me|you|him|her|us|them)|(?:am|is|are|was|were)\s+agree|have\s+\d+\s+years|don't\s+\w+s|doesn't\s+\w+s)\b/i;

export function detectInputLanguagePtOrEn(rawInput: string): 'pt' | 'en' {
  const clean = String(rawInput || '').trim();
  if (!clean) return 'en';
  if (PT_DIACRITICS_REGEX.test(clean)) {
    return 'pt';
  }
  const tokens = clean
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let ptHits = 0;
  for (const t of tokens) {
    if (PT_COMMON_WORDS.has(t)) ptHits++;
  }
  if (ptHits >= 1 && (tokens.length <= 3 || ptHits / Math.max(1, tokens.length) >= 0.25)) {
    return 'pt';
  }
  return 'en';
}

/**
 * Deterministic Single-Input Intent Router:
 * - Words, phrasal verbs, idioms (PT or EN) and Portuguese sentences -> CONSULT_TRANSLATE
 * - English sentences / clauses submitted for verification -> GRAMMAR_CHECK
 */
export function classifyLinguisticIntent(
  rawInput: string,
  override?: 'auto' | 'consult' | 'grammar'
): { mode: LinguisticMode; detectedLanguage: 'pt' | 'en' } {
  const detectedLanguage = detectInputLanguagePtOrEn(rawInput);

  if (override === 'consult') {
    return { mode: 'CONSULT_TRANSLATE', detectedLanguage };
  }
  if (override === 'grammar') {
    return { mode: 'GRAMMAR_CHECK', detectedLanguage };
  }

  // All Portuguese inputs (words, idioms, or full PT sentences) go to Contextual Translator & Consultant
  if (detectedLanguage === 'pt') {
    return { mode: 'CONSULT_TRANSLATE', detectedLanguage: 'pt' };
  }

  const trimmed = String(rawInput || '').trim();
  const lower = trimmed.toLowerCase().replace(/[’‘`]/g, "'");

  // Explicit "to <verb>" dictionary lookup form -> Consult
  if (/^to\s+[a-z]+(?:\s+[a-z]+){0,3}[!?.]*$/i.test(lower)) {
    return { mode: 'CONSULT_TRANSLATE', detectedLanguage: 'en' };
  }

  if (EN_COLLOCATION_ERROR_SNIPPETS.test(lower)) {
    return { mode: 'GRAMMAR_CHECK', detectedLanguage: 'en' };
  }

  const words = lower
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 2) {
    return { mode: 'CONSULT_TRANSLATE', detectedLanguage: 'en' };
  }

  const firstWord = words[0];
  const hasSentenceEndPunct = /[.!?]$/.test(trimmed);

  // Clauses starting with English subject pronouns / modals / question words (e.g. "I have 25 years", "She go to work yesterday")
  if (EN_CLAUSE_STARTERS.has(firstWord) && words.length >= 3) {
    return { mode: 'GRAMMAR_CHECK', detectedLanguage: 'en' };
  }

  // Longer English clauses (6+ words, or 5+ words with sentence punctuation / finite auxiliaries)
  if (
    words.length >= 6 ||
    (words.length >= 5 && hasSentenceEndPunct) ||
    /\b(yesterday|tomorrow|because|although|while|since|already|didn't|doesn't|don't|wasn't|weren't|haven't|hasn't|couldn't|wouldn't|shouldn't)\b/i.test(
      lower
    )
  ) {
    return { mode: 'GRAMMAR_CHECK', detectedLanguage: 'en' };
  }

  // Short 3-5 word idioms & phrasal verbs ("call it a day", "hit the ground running", "under the weather", "piece of cake")
  return { mode: 'CONSULT_TRANSLATE', detectedLanguage: 'en' };
}

/**
 * Verifies that an English example sentence genuinely contains the target expression
 * (including irregular/regular verb inflections, contractions, and separable phrasal verbs).
 */
export function doesSentenceContainExpression(
  sentenceEn: string,
  targetExpression: string
): boolean {
  const cleanSentence = sanitizeGroundingArtifacts(sentenceEn)
    .toLowerCase()
    .replace(/[’‘`]/g, "'");
  if (!cleanSentence || cleanSentence.split(/\s+/).length < 3) {
    return false;
  }

  const canonical = toCanonicalExpressionKey(targetExpression);
  if (!canonical) return true;

  if (cleanSentence.includes(canonical)) {
    return true;
  }

  // Strip optional placeholder pronouns inside dictionary headwords (e.g. "figure it out" -> ["figure", "out"])
  const placeholderSet = new Set([
    'someone',
    'somebody',
    'something',
    "one's",
    'oneself',
    'it',
    'them',
  ]);

  const rawTokens = canonical
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const coreTokens =
    rawTokens.length >= 3
      ? rawTokens.filter((t, idx) => idx === 0 || idx === rawTokens.length - 1 || !placeholderSet.has(t))
      : rawTokens;

  if (coreTokens.length === 0) return true;

  if (coreTokens.length === 1) {
    try {
      const re = new RegExp(`\\b${getWordFormsRegex(coreTokens[0])}\\b`, 'i');
      return re.test(cleanSentence);
    } catch {
      return cleanSentence.includes(coreTokens[0]);
    }
  }

  const firstVerbPattern = getWordFormsRegex(coreTokens[0]);
  const tailPatterns = coreTokens
    .slice(1)
    .map((tok) => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  try {
    const separablePattern =
      `\\b${firstVerbPattern}\\b` +
      `(?:\\s+[a-z']+){0,4}?\\s+` +
      `\\b${tailPatterns.join("(?:\\s+[a-z']+){0,2}?\\s+")}\\b`;
    const re = new RegExp(separablePattern, 'i');
    return re.test(cleanSentence);
  } catch {
    return coreTokens.every((t) => cleanSentence.includes(t));
  }
}

export function normalizeOfficialFolder(raw: unknown, fallback: TopicFolder = 'Frases'): TopicFolder {
  const s = String(raw || '').trim().toLowerCase();
  const found = OFFICIAL_FOLDERS_LIST.find((f) => f.toLowerCase() === s);
  return found ?? fallback;
}

export function normalizeOfficialSubtopic(
  raw: unknown,
  fallback: SubtopicKey = 'Casual'
): SubtopicKey {
  const s = String(raw || '').trim().toLowerCase();
  const found = OFFICIAL_SUBTOPICS_LIST.find((st) => st.toLowerCase() === s);
  return found ?? fallback;
}

const BLOCKED_CURATORSHIP_REGEX =
  /\b(fuck|shit|bitch|asshole|dick|pussy|cunt|nigger|faggot|retard|whore|slut|caralho|porra|buceta|puta|viado|arrombado)\b/i;

/**
 * Guard 1 ("Professor Invisível"):
 * Validates whether a newly consulted expression is worthy of automatic integration
 * into the unified global "Acervo Completo EWM".
 */
export function validateInvisibleTeacherCuratorship(params: {
  aiApproved: boolean;
  englishExpression: string;
  primaryTranslation: string;
  exampleEn: string;
  examplePt: string;
  category: TopicFolder;
  subtopic: SubtopicKey;
}): boolean {
  if (!params.aiApproved) return false;

  const term = sanitizeGroundingArtifacts(params.englishExpression);
  const canonical = toCanonicalExpressionKey(term);
  if (!canonical || canonical.length < 2 || canonical.length > 52) return false;

  // Reject digits, URLs, emails, or strange symbols
  if (/[0-9@#$%^&*_=+<>\\/{}[\]|~]/.test(canonical)) return false;

  // Reject profanity or noise
  if (BLOCKED_CURATORSHIP_REGEX.test(canonical) || BLOCKED_CURATORSHIP_REGEX.test(params.primaryTranslation)) {
    return false;
  }

  const words = canonical.split(/\s+/).filter(Boolean);
  // Only reusable words, phrasal verbs, idioms, or compact fixed expressions (1 to 6 words)
  if (words.length < 1 || words.length > 6) return false;

  // Block personal narrative clauses from entering the global dictionary deck
  if (
    words.length >= 4 &&
    /^(i|my|he|she|we|they|yesterday|tomorrow|last|next)\b/i.test(words[0]) &&
    !/^(i'm in|i'm out|i owe you|i've got this|i'll pass|we're all set)$/i.test(canonical)
  ) {
    return false;
  }

  // Must belong to official folders & subtopics
  if (!OFFICIAL_FOLDERS_LIST.includes(params.category)) return false;
  if (!OFFICIAL_SUBTOPICS_LIST.includes(params.subtopic)) return false;

  // Must have authentic, non-empty example pair (>= 12 chars for Firestore rules parity)
  const cleanExEn = formatCleanExampleSentence(params.exampleEn);
  const cleanExPt = sanitizeGroundingArtifacts(params.examplePt);
  if (cleanExEn.length < 12 || cleanExEn.length > 250) return false;
  if (cleanExPt.length < 3 || cleanExPt.length > 250) return false;
  if (!doesSentenceContainExpression(cleanExEn, canonical)) return false;

  return true;
}
