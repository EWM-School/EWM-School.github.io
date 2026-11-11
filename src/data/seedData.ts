import rawSeed from './rawSeed.json';
import type {
  Flashcard,
  LexiconEntry,
  SecondExamplePair,
  SubtopicKey,
  TopicFolder,
} from '../types/flashcard';

export const VALID_FOLDERS: TopicFolder[] = [
  'Dicas da Mari',
  'Palavras',
  'Frases',
  'Phrasal Verbs',
  'Outros',
];

export const VALID_SUBTOPICS: { key: SubtopicKey; label: string; shortLabel: string }[] = [
  { key: 'Viagens', label: 'Viagens', shortLabel: 'Viagens' },
  { key: 'Clima', label: 'Clima', shortLabel: 'Clima' },
  { key: 'Trabalho', label: 'Trabalho', shortLabel: 'Trabalho' },
  { key: 'Lazer', label: 'Lazer', shortLabel: 'Lazer' },
  { key: 'Casual', label: 'Casual', shortLabel: 'Casual' },
  { key: 'Outros', label: 'Outros', shortLabel: 'Outros' },
];

export const MIN_STUDY_CARDS = 5;
export const MAX_STUDY_CARDS = 20;

// Curated 10-card starter selection across topics so new learners can practice immediately
export const DEFAULT_STARTER_STUDY_IDS: string[] = [
  'c1',
  'c3',
  'c7',
  'c8',
  'c10',
  'mari_1',
  'mari_16',
  'mari_33',
  'pv_1',
  'pv_11',
];

interface RawSeedShape {
  INITIAL_CARDS: Flashcard[];
  TOPIC_BY_ID: Record<string, TopicFolder>;
  SUBTOPIC_BY_ID: Record<string, SubtopicKey>;
  SECOND_EXAMPLES_MAP: Record<string, SecondExamplePair>;
  AI_PT_TO_EN_KB: Record<string, LexiconEntry>;
  AI_COLLOQUIAL_KB: Record<string, LexiconEntry>;
  TEACHER_MASTER_LEXICON: Record<string, LexiconEntry>;
}

const seed = rawSeed as unknown as RawSeedShape;

export const TOPIC_BY_ID: Record<string, TopicFolder> = seed.TOPIC_BY_ID;
export const SUBTOPIC_BY_ID: Record<string, SubtopicKey> = seed.SUBTOPIC_BY_ID;
export const SECOND_EXAMPLES_MAP: Record<string, SecondExamplePair> = seed.SECOND_EXAMPLES_MAP;
export const TEACHER_MASTER_LEXICON: Record<string, LexiconEntry> = seed.TEACHER_MASTER_LEXICON;
export const AI_PT_TO_EN_KB: Record<string, LexiconEntry> = seed.AI_PT_TO_EN_KB;

// Merge Teacher Master Lexicon into AI_COLLOQUIAL_KB as done in the original prototype
const mergedColloquialKb: Record<string, LexiconEntry> = { ...seed.AI_COLLOQUIAL_KB };
for (const [key, val] of Object.entries(TEACHER_MASTER_LEXICON)) {
  if (!mergedColloquialKb[key]) {
    mergedColloquialKb[key] = val;
  }
}

export const AI_COLLOQUIAL_KB: Record<string, LexiconEntry> = mergedColloquialKb;
export const INITIAL_CARDS: Flashcard[] = seed.INITIAL_CARDS;
