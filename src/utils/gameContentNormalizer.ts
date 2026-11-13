import { VALID_FOLDERS, VALID_SUBTOPICS } from '../data/seedData';
import type {
  EnglishAccent,
  Flashcard,
  SubtopicKey,
  TopicFolder,
} from '../types/flashcard';
import { extractPhoneticNotation, getCardSecondExample } from './deckHelpers';
import { getCardPhonetics } from './phonetics';

export const MIN_GAME_POOL_CARDS = 5;
export const LIGHTNING_MIN_PAIRS = 15;
export const LIGHTNING_MAX_PAIRS = 20;
export const LIGHTNING_VISIBLE_SLOTS = 5;
export const NATIVE_EAR_QUESTIONS_PER_MATCH = 8;
export const NATIVE_EAR_SECONDS_PER_QUESTION = 12;
export const SURVIVAL_INITIAL_HEARTS = 3;

export type ArenaTrainingScopeMode = 'review_priority' | 'all' | 'topic';

export interface ArenaScopeFilter {
  mode: ArenaTrainingScopeMode;
  category?: 'all' | TopicFolder;
  subtopic?: 'all' | SubtopicKey;
}

export interface NormalizedGameCard {
  id: string;
  originalCard: Flashcard;
  primaryTerm: string;
  altTerms: string[];
  canonicalTerm: string;
  contextualNote: string | null;
  primaryPt: string;
  normalizedPrimaryPt: string;
  allPtEquivalents: string[];
  normalizedPtSynonyms: Set<string>;
  cleanExampleEn: string;
  cleanExamplePt: string;
  cleanExampleEn2: string;
  cleanExamplePt2: string;
  phoneticUs: string;
  phoneticUk: string;
  category: TopicFolder;
  subtopic: SubtopicKey;
}

export interface ResolvedGamePool {
  cards: NormalizedGameCard[];
  usedFallback: boolean;
  originalMatchCount: number;
  fallbackNoticePt: string | null;
}

export interface BuilderBlockItem {
  id: string;
  text: string;
  normalizedText: string;
}

export interface ExpressionBuilderRound {
  roundId: string;
  card: NormalizedGameCard;
  targetEnglish: string;
  promptPt: string;
  helperContextPt: string | null;
  terminalPunctuation: '.' | '?' | '!';
  expectedBlocks: BuilderBlockItem[];
  shuffledTray: BuilderBlockItem[];
  speechRole: 'term' | 'sentence';
}

export interface NativeEarOption {
  id: string;
  cardId: string;
  labelPt: string;
  isCorrect: boolean;
}

export interface NativeEarQuestion {
  questionId: string;
  card: NormalizedGameCard;
  spokenText: string;
  accent: EnglishAccent;
  options: NativeEarOption[];
}

export type NativeEarAccentMode = 'us' | 'uk' | 'mixed';

export interface LightningPairItem {
  pairId: string;
  cardId: string;
  englishText: string;
  portugueseText: string;
  contextualNote: string | null;
  card: NormalizedGameCard;
}

export type SurvivalChallengeKind = 'cloze' | 'listening' | 'translation';

export interface SurvivalOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface SurvivalChallenge {
  challengeId: string;
  kind: SurvivalChallengeKind;
  card: NormalizedGameCard;
  promptTitlePt: string;
  promptPrimary: string;
  promptSecondaryPt: string | null;
  spokenText?: string;
  accent: EnglishAccent;
  options: SurvivalOption[];
  correctAnswerLabel: string;
  explanationLinePt: string;
}

const IRREGULAR_VERB_FAMILIES: Record<string, string[]> = {
  be: ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  break: ['break', 'breaks', 'broke', 'broken', 'breaking'],
  bring: ['bring', 'brings', 'brought', 'bringing'],
  buy: ['buy', 'buys', 'bought', 'buying'],
  catch: ['catch', 'catches', 'caught', 'catching'],
  come: ['come', 'comes', 'came', 'coming'],
  cut: ['cut', 'cuts', 'cutting'],
  do: ['do', 'does', 'did', 'done', 'doing'],
  eat: ['eat', 'eats', 'ate', 'eaten', 'eating'],
  fall: ['fall', 'falls', 'fell', 'fallen', 'falling'],
  feel: ['feel', 'feels', 'felt', 'feeling'],
  find: ['find', 'finds', 'found', 'finding'],
  get: ['get', 'gets', 'got', 'gotten', 'getting'],
  give: ['give', 'gives', 'gave', 'given', 'giving'],
  go: ['go', 'goes', 'went', 'gone', 'going'],
  grow: ['grow', 'grows', 'grew', 'grown', 'growing'],
  hang: ['hang', 'hangs', 'hung', 'hanged', 'hanging'],
  have: ['have', 'has', 'had', 'having'],
  hear: ['hear', 'hears', 'heard', 'hearing'],
  hit: ['hit', 'hits', 'hitting'],
  hold: ['hold', 'holds', 'held', 'holding'],
  keep: ['keep', 'keeps', 'kept', 'keeping'],
  know: ['know', 'knows', 'knew', 'known', 'knowing'],
  lay: ['lay', 'lays', 'laid', 'laying'],
  leave: ['leave', 'leaves', 'left', 'leaving'],
  let: ['let', 'lets', 'letting'],
  lose: ['lose', 'loses', 'lost', 'losing'],
  make: ['make', 'makes', 'made', 'making'],
  meet: ['meet', 'meets', 'met', 'meeting'],
  pay: ['pay', 'pays', 'paid', 'paying'],
  put: ['put', 'puts', 'putting'],
  read: ['read', 'reads', 'reading'],
  run: ['run', 'runs', 'ran', 'running'],
  say: ['say', 'says', 'said', 'saying'],
  see: ['see', 'sees', 'saw', 'seen', 'seeing'],
  send: ['send', 'sends', 'sent', 'sending'],
  set: ['set', 'sets', 'setting'],
  shake: ['shake', 'shakes', 'shook', 'shaken', 'shaking'],
  show: ['show', 'shows', 'showed', 'shown', 'showing'],
  shut: ['shut', 'shuts', 'shutting'],
  sit: ['sit', 'sits', 'sat', 'sitting'],
  sleep: ['sleep', 'sleeps', 'slept', 'sleeping'],
  speak: ['speak', 'speaks', 'spoke', 'spoken', 'speaking'],
  spend: ['spend', 'spends', 'spent', 'spending'],
  stand: ['stand', 'stands', 'stood', 'standing'],
  stick: ['stick', 'sticks', 'stuck', 'sticking'],
  take: ['take', 'takes', 'took', 'taken', 'taking'],
  tell: ['tell', 'tells', 'told', 'telling'],
  think: ['think', 'thinks', 'thought', 'thinking'],
  throw: ['throw', 'throws', 'threw', 'thrown', 'throwing'],
  wear: ['wear', 'wears', 'wore', 'worn', 'wearing'],
  wind: ['wind', 'winds', 'wound', 'winding'],
  write: ['write', 'writes', 'wrote', 'written', 'writing'],
};

const SYNTAGM_STARTERS = new Set([
  'a',
  'an',
  'the',
  'my',
  'your',
  'his',
  'her',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'some',
  'any',
  'no',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'from',
  'by',
  'about',
  'into',
  'before',
  'after',
  'under',
  'over',
  'without',
  'during',
]);

const AUX_PAIRS = new Set([
  'i am',
  'you are',
  'we are',
  'they are',
  'he is',
  'she is',
  'it is',
  'i was',
  'we were',
  'i have',
  'you have',
  'we have',
  'i will',
  'we will',
  'going to',
  'have to',
  'has to',
  'had to',
  'need to',
  'needs to',
  'want to',
  'wants to',
  'used to',
  'able to',
  'supposed to',
  'trying to',
  'out of',
  'up with',
  'forward to',
  'a lot',
  'a bit',
  'a little',
  'right now',
  'so far',
  'at all',
]);

function normalizeApostrophes(input: string): string {
  return String(input || '')
    .replace(/([A-Za-z])[’‘ʼ`]([A-Za-z])/g, "$1'$2")
    .replace(/([A-Za-z]s)[’‘ʼ`](?=\s|[.,!?;:]|$)/g, "$1'");
}

function normalizeComparableText(input: string): string {
  return normalizeApostrophes(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBuilderTokenText(token: string): string {
  return normalizeApostrophes(token)
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts parenthetical or bracketed editorial notes (e.g. `(informal)`, `[gíria]`)
 * while stripping phonetic tags `(Pronúncia: ...)` and `/.../` transcriptions.
 */
export function extractEditorialNotesAndClean(raw: string): {
  cleaned: string;
  notes: string[];
} {
  let text = normalizeApostrophes(String(raw || '').trim());
  if (!text) return { cleaned: '', notes: [] };

  // Remove coupled arrow translation if accidentally present
  text = text.replace(/\s*(?:→|->|⇒)\s*.+$/u, '');

  // Strip phonetic tags `(Pronúncia: ...)` first
  const { meaning } = extractPhoneticNotation(text);
  text = meaning;

  // Strip slash-delimited IPA/phonetics `/rép ÂP/`
  text = text.replace(
    /(^|[\s([{"“'—–·•])\/(?!\s)[^/\r\n]{1,64}(?<!\s)\/(?=$|[\s)\]}"”'.,!?;:—–·•])/gu,
    '$1 '
  );

  const notes: string[] = [];
  const collectNote = (_full: string, inner: string) => {
    const trimmed = String(inner || '')
      .replace(/^pron[uú]ncia\s*:.*/i, '')
      .trim();
    if (trimmed && trimmed.length <= 48) {
      notes.push(trimmed);
    }
    return ' ';
  };

  for (let pass = 0; pass < 2; pass++) {
    text = text.replace(/\(([^)]*)\)/g, collectNote);
    text = text.replace(/\[([^\]]*)\]/g, collectNote);
  }

  text = text
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ' ')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\uFE0E\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[“”"«»„]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleaned: text, notes };
}

/**
 * Splits slash-separated English or Portuguese variants (`"hang up / end the call"`)
 * into clean standalone alternatives without breaking numeric ratios (`24/7`).
 */
export function splitSlashVariantsCleanly(cleanedText: string): string[] {
  const base = String(cleanedText || '').trim();
  if (!base) return [];

  // Protect numeric ratios like 24/7
  const SENTINEL = '__NUM_SLASH__';
  const protectedNumeric = base.replace(/(\d)\s*\/\s*(\d)/g, `$1${SENTINEL}$2`);

  const parts = protectedNumeric
    .split(/\s+\/\s+|(?<=[A-Za-z'])\/(?=[A-Za-z'])/)
    .map((segment) =>
      segment
        .replace(new RegExp(SENTINEL, 'g'), '/')
        .replace(/^[•·\-–—,;:\s]+|[•·\-–—,;:\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((segment) => /[A-Za-zÀ-ÿ0-9]/.test(segment));

  return parts.length > 0 ? parts : [base.replace(/\//g, ' ').replace(/\s+/g, ' ').trim()];
}

function cleanPtMeaningCandidate(raw: string): string {
  const { cleaned } = extractEditorialNotesAndClean(raw);
  const variants = splitSlashVariantsCleanly(cleaned);
  const primary = (variants[0] || cleaned)
    .replace(/^→\s*/, '')
    .replace(/[.!?]+$/, '')
    .trim();
  return primary;
}

function cleanSentenceForGame(raw: string, keepTerminalPunct = true): string {
  const { cleaned } = extractEditorialNotesAndClean(raw);
  const variants = splitSlashVariantsCleanly(cleaned);
  let sentence = (variants[0] || cleaned)
    .replace(/^\s*\d{1,2}\s*(?:·|\.\s+|\)\s+)\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sentence) return '';
  if (!keepTerminalPunct) {
    sentence = sentence.replace(/[.!?]+$/, '').trim();
  }
  return sentence;
}

/**
 * Sanitizes any `Flashcard` from the EWM catalog/custom collection into a deterministic,
 * frustration-free `NormalizedGameCard` (zero `"/"` tiles, zero `(informal)` noise inside blocks).
 */
export function normalizeCardForMiniGame(card: Flashcard): NormalizedGameCard | null {
  if (!card || !card.term) return null;

  const termExtracted = extractEditorialNotesAndClean(card.term);
  const termVariants = splitSlashVariantsCleanly(termExtracted.cleaned);
  const rawPrimaryTerm = (termVariants[0] || '').replace(/[.!?]+$/, '').trim();
  if (!rawPrimaryTerm || !/[A-Za-z]/.test(rawPrimaryTerm)) return null;

  const altTerms = termVariants
    .slice(1)
    .map((v) => v.replace(/[.!?]+$/, '').trim())
    .filter(Boolean);

  const literalExtracted = extractEditorialNotesAndClean(card.literal || '');
  const allNotes = [...termExtracted.notes, ...literalExtracted.notes];
  const uniqueNotes = Array.from(new Set(allNotes.map((n) => n.trim()).filter(Boolean)));
  const contextualNote = uniqueNotes.length > 0 ? uniqueNotes.join(' · ') : null;

  const ptCandidates: string[] = [];
  for (const col of card.colloquial || []) {
    for (const part of splitSlashVariantsCleanly(extractEditorialNotesAndClean(col).cleaned)) {
      const cleanedPart = cleanPtMeaningCandidate(part);
      if (cleanedPart) ptCandidates.push(cleanedPart);
    }
  }
  if (ptCandidates.length === 0) {
    for (const part of splitSlashVariantsCleanly(literalExtracted.cleaned)) {
      const cleanedPart = cleanPtMeaningCandidate(part);
      if (cleanedPart) ptCandidates.push(cleanedPart);
    }
  }

  const dedupedPt: string[] = [];
  const normPtSet = new Set<string>();
  for (const cand of ptCandidates) {
    const norm = normalizeComparableText(cand);
    if (norm && !normPtSet.has(norm)) {
      normPtSet.add(norm);
      dedupedPt.push(cand);
    }
  }

  const primaryPt = dedupedPt[0] || cleanPtMeaningCandidate(card.literal) || rawPrimaryTerm;
  const normalizedPrimaryPt = normalizeComparableText(primaryPt);
  if (!normalizedPrimaryPt) return null;
  normPtSet.add(normalizedPrimaryPt);

  const sec = getCardSecondExample(card);
  const cleanExampleEn = cleanSentenceForGame(card.exampleEn, true);
  const cleanExamplePt = cleanSentenceForGame(card.examplePt, true);
  const cleanExampleEn2 = cleanSentenceForGame(card.exampleEn2 || sec.en, true);
  const cleanExamplePt2 = cleanSentenceForGame(card.examplePt2 || sec.pt, true);

  const phonetics = getCardPhonetics(card);
  const validCategory = VALID_FOLDERS.includes(card.category) ? card.category : 'Frases';
  const validSubtopic = VALID_SUBTOPICS.some((s) => s.key === card.subtopic)
    ? card.subtopic
    : 'Casual';

  return {
    id: card.id,
    originalCard: card,
    primaryTerm: rawPrimaryTerm,
    altTerms,
    canonicalTerm: normalizeComparableText(rawPrimaryTerm).replace(/^to\s+/, ''),
    contextualNote,
    primaryPt,
    normalizedPrimaryPt,
    allPtEquivalents: dedupedPt.length > 0 ? dedupedPt : [primaryPt],
    normalizedPtSynonyms: normPtSet,
    cleanExampleEn,
    cleanExamplePt,
    cleanExampleEn2,
    cleanExamplePt2,
    phoneticUs: phonetics.us,
    phoneticUk: phonetics.uk,
    category: validCategory,
    subtopic: validSubtopic,
  };
}

/**
 * Resolves the active card pool for the Arena's top Training Scope Filter:
 * - `review_priority`: Prioritizes non-mastered cards (`review` first, then `unseen`)
 * - `all`: Full EWM Catalog + Student Creations
 * - `topic`: Filtered by Official Folder and/or Subtopic
 *
 * Graceful Volume Fallback: If the chosen filter yields `< minCards` (default 5),
 * automatically tops up from `allCards` with a discreet pedagogical notice so no game ever stalls.
 */
export function resolveMiniGameCardPool(
  allCards: readonly Flashcard[],
  filter: ArenaScopeFilter,
  minCards: number = MIN_GAME_POOL_CARDS
): ResolvedGamePool {
  const allNormalized: NormalizedGameCard[] = [];
  const seenCanonical = new Set<string>();

  for (const rawCard of allCards) {
    const norm = normalizeCardForMiniGame(rawCard);
    if (!norm || !norm.canonicalTerm || seenCanonical.has(norm.canonicalTerm)) continue;
    seenCanonical.add(norm.canonicalTerm);
    allNormalized.push(norm);
  }

  let matched: NormalizedGameCard[] = [];

  if (filter.mode === 'review_priority') {
    const reviewFirst = allNormalized.filter((c) => c.originalCard.status === 'review');
    const unseenNext = allNormalized.filter((c) => c.originalCard.status === 'unseen');
    matched = [...reviewFirst, ...unseenNext];
  } else if (filter.mode === 'topic') {
    matched = allNormalized.filter((c) => {
      const catOk =
        !filter.category || filter.category === 'all' || c.category === filter.category;
      const subOk =
        !filter.subtopic || filter.subtopic === 'all' || c.subtopic === filter.subtopic;
      return catOk && subOk;
    });
  } else {
    matched = [...allNormalized];
  }

  const originalMatchCount = matched.length;
  const requiredMin = Math.max(MIN_GAME_POOL_CARDS, minCards);

  if (matched.length >= requiredMin || allNormalized.length <= matched.length) {
    return {
      cards: matched.length > 0 ? matched : allNormalized,
      usedFallback: false,
      originalMatchCount,
      fallbackNoticePt: null,
    };
  }

  const selectedIds = new Set(matched.map((c) => c.id));
  const toppedUp = [...matched];
  for (const extra of allNormalized) {
    if (selectedIds.has(extra.id)) continue;
    selectedIds.add(extra.id);
    toppedUp.push(extra);
    if (toppedUp.length >= requiredMin) break;
  }

  const fallbackNoticePt =
    originalMatchCount === 0
      ? 'Nenhum card pendente neste filtro — completamos a partida com expressões do Acervo EWM.'
      : `Apenas ${originalMatchCount} ${
          originalMatchCount === 1 ? 'card disponível' : 'cards disponíveis'
        } neste filtro — completamos o pool com o Acervo EWM.`;

  return {
    cards: toppedUp,
    usedFallback: originalMatchCount < MIN_GAME_POOL_CARDS,
    originalMatchCount,
    fallbackNoticePt: originalMatchCount < MIN_GAME_POOL_CARDS ? fallbackNoticePt : null,
  };
}

export function shuffleDeterministicOrRandom<T>(
  items: readonly T[],
  rng: () => number = Math.random
): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Checks if two cards have identical or overlapping Portuguese translations
 * so multiple-choice distractors are 100% unambiguous.
 */
export function areMeaningsColliding(a: NormalizedGameCard, b: NormalizedGameCard): boolean {
  if (a.id === b.id || a.canonicalTerm === b.canonicalTerm) return true;
  if (a.normalizedPrimaryPt === b.normalizedPrimaryPt) return true;

  for (const synA of a.normalizedPtSynonyms) {
    if (b.normalizedPtSynonyms.has(synA)) return true;
  }

  if (
    a.normalizedPrimaryPt.length >= 5 &&
    b.normalizedPrimaryPt.length >= 5 &&
    (a.normalizedPrimaryPt.includes(b.normalizedPrimaryPt) ||
      b.normalizedPrimaryPt.includes(a.normalizedPrimaryPt))
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// MINI-GAME #1: MONTE A EXPRESSÃO (`Expression / Sentence Builder`)
// ============================================================================

/**
 * Tokenizes an English phrase/sentence into clean playable words (never containing `"/"` or trailing `.?!`),
 * and automatically groups short functional syntagms when `words.length > 9` so long sentences (`> 10` words)
 * always stay ergonomically between `5` and `9` clickable blocks on mobile screens.
 */
export function tokenizeAndChunkForBuilder(rawEnglish: string): {
  blocks: string[];
  cleanTargetSentence: string;
  terminalPunctuation: '.' | '?' | '!';
} {
  const { cleaned } = extractEditorialNotesAndClean(rawEnglish);
  const primarySegment = splitSlashVariantsCleanly(cleaned)[0] || cleaned;

  const trimmed = primarySegment.trim();
  const punctMatch = trimmed.match(/([.!?])+$/);
  const terminalPunctuation: '.' | '?' | '!' =
    punctMatch && (punctMatch[1] === '?' || punctMatch[1] === '!')
      ? (punctMatch[1] as '?' | '!')
      : '.';

  // Separate em/en-dashes and slashes into clean word spaces and strip stray punctuation around words
  const rawWords = trimmed
    .replace(/[.!?]+$/, '')
    .replace(/[—–/]+/g, ' ')
    .split(/\s+/)
    .map((w) =>
      w
        .replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '')
        .trim()
    )
    .filter((w) => /[A-Za-z0-9]/.test(w));

  if (rawWords.length === 0) {
    return { blocks: [], cleanTargetSentence: '', terminalPunctuation };
  }

  const cleanTargetSentence = `${rawWords.join(' ')}${terminalPunctuation}`;

  // Short/medium phrases (<= 9 words): 1 word per block
  if (rawWords.length <= 9) {
    return {
      blocks: rawWords,
      cleanTargetSentence,
      terminalPunctuation,
    };
  }

  // Long sentences (> 9 / > 10 words): smart syntagmatic grouping into 5..9 blocks
  let chunks = [...rawWords];

  // Pass 1: Merge natural auxiliary / functional 2-word phrases (`going to`, `in the`, `my boss`, etc.)
  let idx = 0;
  while (idx < chunks.length - 1 && chunks.length > 8) {
    const leftNorm = chunks[idx].toLowerCase();
    const pairNorm = `${leftNorm} ${chunks[idx + 1].toLowerCase()}`;
    const nextWordCount = chunks[idx + 1].split(' ').length;

    if (
      nextWordCount === 1 &&
      (AUX_PAIRS.has(pairNorm) || SYNTAGM_STARTERS.has(leftNorm))
    ) {
      chunks.splice(idx, 2, `${chunks[idx]} ${chunks[idx + 1]}`);
      idx += 1;
    } else {
      idx += 1;
    }
  }

  // Pass 2: Deterministic shortest-adjacent-pair merge if still > 9 blocks (never dropping below 5)
  while (chunks.length > 9 && chunks.length > 5) {
    let bestIndex = 0;
    let bestCombinedLen = Number.POSITIVE_INFINITY;
    for (let i = 0; i < chunks.length - 1; i++) {
      const combinedLen = chunks[i].length + 1 + chunks[i + 1].length;
      if (combinedLen < bestCombinedLen) {
        bestCombinedLen = combinedLen;
        bestIndex = i;
      }
    }
    chunks.splice(bestIndex, 2, `${chunks[bestIndex]} ${chunks[bestIndex + 1]}`);
  }

  return {
    blocks: chunks,
    cleanTargetSentence,
    terminalPunctuation,
  };
}

export function buildExpressionBuilderRound(
  card: NormalizedGameCard,
  options?: { preferSentence?: boolean; rng?: () => number }
): ExpressionBuilderRound {
  const rng = options?.rng ?? Math.random;
  const termWordCount = card.primaryTerm.split(/\s+/).filter(Boolean).length;

  const useTermDirectly =
    options?.preferSentence === false
      ? termWordCount >= 2
      : !options?.preferSentence &&
        termWordCount >= 3 &&
        (!card.cleanExampleEn || rng() < 0.45);

  const rawSourceEn =
    useTermDirectly || !card.cleanExampleEn ? card.primaryTerm : card.cleanExampleEn;
  const promptPt =
    useTermDirectly || !card.cleanExamplePt ? card.primaryPt : card.cleanExamplePt;

  const { blocks, cleanTargetSentence, terminalPunctuation } =
    tokenizeAndChunkForBuilder(rawSourceEn);

  const expectedBlocks: BuilderBlockItem[] = blocks.map((text, index) => ({
    id: `blk_${card.id}_${index}`,
    text,
    normalizedText: normalizeBuilderTokenText(text),
  }));

  let shuffledTray = shuffleDeterministicOrRandom(expectedBlocks, rng);
  if (
    expectedBlocks.length >= 2 &&
    shuffledTray.every((b, idx) => b.normalizedText === expectedBlocks[idx].normalizedText)
  ) {
    // Rotate by 1 to guarantee tray is never already solved on initial render
    shuffledTray = [...shuffledTray.slice(1), shuffledTray[0]];
  }

  const helperContextPt = useTermDirectly
    ? card.contextualNote
    : [
        `Expressão-alvo: ${card.primaryPt}`,
        card.contextualNote ? `(${card.contextualNote})` : null,
      ]
        .filter(Boolean)
        .join(' ');

  return {
    roundId: `builder_${card.id}_${expectedBlocks.length}`,
    card,
    targetEnglish: cleanTargetSentence,
    promptPt,
    helperContextPt: helperContextPt || null,
    terminalPunctuation,
    expectedBlocks,
    shuffledTray,
    speechRole: useTermDirectly ? 'term' : 'sentence',
  };
}

/**
 * Validates assembled blocks by normalized text sequence (NOT block IDs!),
 * making identical tokens (`"the"`, `"to"`, `"a"`) 100% interchangeable with zero false negatives.
 */
export function validateExpressionBuilderAttempt(
  placedBlocks: readonly Pick<BuilderBlockItem, 'text' | 'normalizedText'>[],
  expectedBlocks: readonly Pick<BuilderBlockItem, 'text' | 'normalizedText'>[]
): {
  isComplete: boolean;
  isCorrect: boolean;
  slotMatches: boolean[];
} {
  const slotMatches = expectedBlocks.map((expected, idx) => {
    const candidate = placedBlocks[idx];
    if (!candidate) return false;
    const candNorm = candidate.normalizedText || normalizeBuilderTokenText(candidate.text);
    const expNorm = expected.normalizedText || normalizeBuilderTokenText(expected.text);
    return candNorm === expNorm;
  });

  const isComplete = placedBlocks.length === expectedBlocks.length && expectedBlocks.length > 0;
  const isCorrect = isComplete && slotMatches.every(Boolean);

  return { isComplete, isCorrect, slotMatches };
}

// ============================================================================
// MINI-GAME #2: OUVIDO DE NATIVO (`Native Ear Sprint — US & UK`)
// ============================================================================

export function buildNativeEarQuestions(
  pool: readonly NormalizedGameCard[],
  allReferenceCards: readonly NormalizedGameCard[],
  accentMode: NativeEarAccentMode = 'mixed',
  count: number = NATIVE_EAR_QUESTIONS_PER_MATCH,
  rng: () => number = Math.random
): NativeEarQuestion[] {
  if (pool.length === 0) return [];
  const distractorUniverse =
    allReferenceCards.length >= 4 ? allReferenceCards : pool;

  const shuffledPool = shuffleDeterministicOrRandom(pool, rng);
  const selectedTargets: NormalizedGameCard[] = [];
  for (let i = 0; i < count; i++) {
    selectedTargets.push(shuffledPool[i % shuffledPool.length]);
  }

  return selectedTargets.map((targetCard, idx) => {
    const accent: EnglishAccent =
      accentMode === 'us'
        ? 'us'
        : accentMode === 'uk'
        ? 'uk'
        : idx % 2 === 0
        ? 'us'
        : 'uk';

    const candidateDistractors = shuffleDeterministicOrRandom(distractorUniverse, rng);
    const chosenDistractors: NormalizedGameCard[] = [];
    const usedNormalizedLabels = new Set<string>([targetCard.normalizedPrimaryPt]);

    // Prefer same category first for realistic pedagogical challenge, then broaden
    const orderedDistractors = [
      ...candidateDistractors.filter((c) => c.category === targetCard.category),
      ...candidateDistractors.filter((c) => c.category !== targetCard.category),
    ];

    for (const cand of orderedDistractors) {
      if (chosenDistractors.length >= 3) break;
      if (areMeaningsColliding(targetCard, cand)) continue;
      if (chosenDistractors.some((existing) => areMeaningsColliding(existing, cand))) continue;
      if (usedNormalizedLabels.has(cand.normalizedPrimaryPt)) continue;

      usedNormalizedLabels.add(cand.normalizedPrimaryPt);
      chosenDistractors.push(cand);
    }

    const rawOptions: NativeEarOption[] = [
      {
        id: `ear_${idx}_correct_${targetCard.id}`,
        cardId: targetCard.id,
        labelPt: targetCard.primaryPt,
        isCorrect: true,
      },
      ...chosenDistractors.map((d, dIdx) => ({
        id: `ear_${idx}_dist_${dIdx}_${d.id}`,
        cardId: d.id,
        labelPt: d.primaryPt,
        isCorrect: false,
      })),
    ];

    return {
      questionId: `ear_q_${idx}_${targetCard.id}`,
      card: targetCard,
      spokenText: targetCard.primaryTerm,
      accent,
      options: shuffleDeterministicOrRandom(rawOptions, rng),
    };
  });
}

// ============================================================================
// MINI-GAME #3: JOGO DA MEMÓRIA RELÂMPAGO (`Lightning Match`)
// ============================================================================

export function buildLightningMatchDeck(
  pool: readonly NormalizedGameCard[],
  allReferenceCards: readonly NormalizedGameCard[],
  desiredPairs = 16,
  rng: () => number = Math.random
): LightningPairItem[] {
  const clampedTarget = Math.max(
    LIGHTNING_MIN_PAIRS,
    Math.min(LIGHTNING_MAX_PAIRS, desiredPairs)
  );

  const primaryShuffled = shuffleDeterministicOrRandom(pool, rng);
  const backupShuffled = shuffleDeterministicOrRandom(allReferenceCards, rng);
  const combinedCandidates = [...primaryShuffled, ...backupShuffled];

  const chosen: NormalizedGameCard[] = [];
  for (const cand of combinedCandidates) {
    if (chosen.length >= clampedTarget) break;
    if (chosen.some((existing) => areMeaningsColliding(existing, cand))) continue;
    chosen.push(cand);
  }

  return chosen.map((card, index) => ({
    pairId: `lm_${index}_${card.id}`,
    cardId: card.id,
    englishText: card.primaryTerm,
    portugueseText: card.primaryPt,
    contextualNote: card.contextualNote,
    card,
  }));
}

// ============================================================================
// MINI-GAME #4: DESAFIO SOBREVIVÊNCIA (`Survival Mode — 3 Vidas`)
// ============================================================================

function getWordInflectionVariants(word: string): string[] {
  const lower = word.toLowerCase();
  for (const forms of Object.values(IRREGULAR_VERB_FAMILIES)) {
    if (forms.includes(lower)) return forms;
  }

  const variants = new Set<string>([
    lower,
    `${lower}s`,
    `${lower}es`,
    `${lower}d`,
    `${lower}ed`,
    `${lower}ing`,
  ]);
  if (lower.endsWith('e') && lower.length > 2) {
    variants.add(`${lower.slice(0, -1)}ing`);
  }
  if (lower.endsWith('y') && lower.length > 2) {
    variants.add(`${lower.slice(0, -1)}ies`);
    variants.add(`${lower.slice(0, -1)}ied`);
  }
  if (/^[a-z]*[aeiou][bdfgklmnprstvz]$/.test(lower) && lower.length <= 5) {
    const last = lower[lower.length - 1];
    variants.add(`${lower}${last}ed`);
    variants.add(`${lower}${last}ing`);
  }
  return Array.from(variants);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Masks the target English expression inside `sentenceEn` with `______`
 * (supporting verb inflections and separable phrasal verbs).
 * Returns `null` if no unambiguous mask could be constructed.
 */
export function maskExpressionInSentence(
  sentenceEn: string,
  primaryTerm: string,
  altTerms: readonly string[] = []
): string | null {
  if (!sentenceEn || !primaryTerm) return null;

  const candidates = [primaryTerm, ...altTerms]
    .map((t) => t.replace(/^to\s+/i, '').trim())
    .filter(Boolean);

  for (const term of candidates) {
    const words = term.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const firstVariants = getWordInflectionVariants(words[0]).map(escapeRegex);
    const firstGroup = `(?:${firstVariants.join('|')})`;

    if (words.length === 1) {
      const rx = new RegExp(`\\b${firstGroup}\\b`, 'i');
      if (rx.test(sentenceEn)) {
        return sentenceEn.replace(rx, '______');
      }
    } else {
      const restEscaped = words.slice(1).map(escapeRegex);
      const contiguousRx = new RegExp(
        `\\b${firstGroup}\\s+${restEscaped.join('\\s+')}\\b`,
        'i'
      );
      if (contiguousRx.test(sentenceEn)) {
        return sentenceEn.replace(contiguousRx, '______');
      }

      // Separable 2-word phrasal verb (`figure it out`, `let his team down` -> `______ his team ______`)
      if (words.length === 2) {
        const sepRx = new RegExp(
          `\\b(${firstGroup})\\s+([a-z']+(?:\\s+[a-z']+){0,2})\\s+(${restEscaped[0]})\\b`,
          'i'
        );
        if (sepRx.test(sentenceEn)) {
          return sentenceEn.replace(sepRx, '______ $2 ______');
        }
      }
    }
  }

  return null;
}

export function buildSurvivalChallenge(
  targetCard: NormalizedGameCard,
  allReferenceCards: readonly NormalizedGameCard[],
  stepIndex: number,
  rng: () => number = Math.random
): SurvivalChallenge {
  const cycleKinds: SurvivalChallengeKind[] = ['cloze', 'listening', 'translation'];
  const desiredKind = cycleKinds[stepIndex % cycleKinds.length];

  const maskedExample = maskExpressionInSentence(
    targetCard.cleanExampleEn,
    targetCard.primaryTerm,
    targetCard.altTerms
  );

  const resolvedKind: SurvivalChallengeKind =
    desiredKind === 'cloze' && !maskedExample ? 'translation' : desiredKind;

  const accent: EnglishAccent = stepIndex % 2 === 0 ? 'us' : 'uk';

  const candidates = shuffleDeterministicOrRandom(allReferenceCards, rng);
  const sameCatFirst = [
    ...candidates.filter((c) => c.category === targetCard.category),
    ...candidates.filter((c) => c.category !== targetCard.category),
  ];

  const distractors: NormalizedGameCard[] = [];
  const usedTerms = new Set<string>([targetCard.canonicalTerm]);
  const usedPts = new Set<string>([targetCard.normalizedPrimaryPt]);

  for (const cand of sameCatFirst) {
    if (distractors.length >= 3) break;
    if (areMeaningsColliding(targetCard, cand)) continue;
    if (distractors.some((d) => areMeaningsColliding(d, cand))) continue;
    if (usedTerms.has(cand.canonicalTerm) || usedPts.has(cand.normalizedPrimaryPt)) continue;

    usedTerms.add(cand.canonicalTerm);
    usedPts.add(cand.normalizedPrimaryPt);
    distractors.push(cand);
  }

  if (resolvedKind === 'listening') {
    const options = shuffleDeterministicOrRandom<SurvivalOption>(
      [
        {
          id: `surv_${stepIndex}_ok_${targetCard.id}`,
          label: targetCard.primaryPt,
          isCorrect: true,
        },
        ...distractors.map((d, idx) => ({
          id: `surv_${stepIndex}_d_${idx}_${d.id}`,
          label: d.primaryPt,
          isCorrect: false,
        })),
      ],
      rng
    );

    return {
      challengeId: `surv_${stepIndex}_listen_${targetCard.id}`,
      kind: 'listening',
      card: targetCard,
      promptTitlePt: 'Escuta Rápida · O que o nativo disse?',
      promptPrimary: 'Ouça o áudio e escolha o sentido equivalente em português',
      promptSecondaryPt: targetCard.contextualNote,
      spokenText: targetCard.primaryTerm,
      accent,
      options,
      correctAnswerLabel: targetCard.primaryPt,
      explanationLinePt: `"${targetCard.primaryTerm}" significa "${targetCard.primaryPt}".`,
    };
  }

  if (resolvedKind === 'cloze' && maskedExample) {
    const options = shuffleDeterministicOrRandom<SurvivalOption>(
      [
        {
          id: `surv_${stepIndex}_ok_${targetCard.id}`,
          label: targetCard.primaryTerm,
          isCorrect: true,
        },
        ...distractors.map((d, idx) => ({
          id: `surv_${stepIndex}_d_${idx}_${d.id}`,
          label: d.primaryTerm,
          isCorrect: false,
        })),
      ],
      rng
    );

    return {
      challengeId: `surv_${stepIndex}_cloze_${targetCard.id}`,
      kind: 'cloze',
      card: targetCard,
      promptTitlePt: 'Complete a Lacuna no Contexto Real',
      promptPrimary: maskedExample,
      promptSecondaryPt: targetCard.cleanExamplePt || targetCard.primaryPt,
      spokenText: targetCard.cleanExampleEn,
      accent,
      options,
      correctAnswerLabel: targetCard.primaryTerm,
      explanationLinePt: `A expressão correta é "${targetCard.primaryTerm}" (${targetCard.primaryPt}).`,
    };
  }

  // `translation`: Natural PT -> Real English Expression
  const options = shuffleDeterministicOrRandom<SurvivalOption>(
    [
      {
        id: `surv_${stepIndex}_ok_${targetCard.id}`,
        label: targetCard.primaryTerm,
        isCorrect: true,
      },
      ...distractors.map((d, idx) => ({
        id: `surv_${stepIndex}_d_${idx}_${d.id}`,
        label: d.primaryTerm,
        isCorrect: false,
      })),
    ],
    rng
  );

  return {
    challengeId: `surv_${stepIndex}_trans_${targetCard.id}`,
    kind: 'translation',
    card: targetCard,
    promptTitlePt: 'Como um nativo diria no dia a dia?',
    promptPrimary: targetCard.primaryPt,
    promptSecondaryPt: targetCard.contextualNote,
    spokenText: targetCard.primaryTerm,
    accent,
    options,
    correctAnswerLabel: targetCard.primaryTerm,
    explanationLinePt: `Em inglês natural: "${targetCard.primaryTerm}" → ${targetCard.primaryPt}.`,
  };
}
