export type TopicFolder =
  | 'Dicas da Mari'
  | 'Palavras'
  | 'Frases'
  | 'Phrasal Verbs'
  | 'Outros';

export type SubtopicKey =
  | 'Viagens'
  | 'Clima'
  | 'Trabalho'
  | 'Lazer'
  | 'Casual'
  | 'Outros';

export type CardStatus = 'unseen' | 'review' | 'mastered';

export type CardOrigin = 'seed' | 'global' | 'custom';

export type MainPillar = 'study' | 'speaking' | 'games';

export type StudySubMode = 'study' | 'decks' | 'list';

export type AppTab = 'study' | 'decks' | 'quiz' | 'list' | 'speaking' | 'games';

export type StudyScope = 'selected' | 'decks' | 'all';

export type StatusFilter = 'all' | 'review' | 'unseen' | 'mastered';

export type ListSelectionFilter = 'all' | 'selected' | 'unselected';

export type ListViewMode = 'grid' | 'compact';

export type ThemeMode = 'light' | 'dark';

export type EnglishAccent = 'us' | 'uk';

export type DeckColorTag = 'sage' | 'ochre' | 'slate' | 'terracotta';

export type SyncStatus = 'visitor' | 'syncing' | 'synced' | 'offline' | 'error';

export interface Flashcard {
  id: string;
  term: string;
  category: TopicFolder;
  subtopic: SubtopicKey;
  literal: string;
  phoneticUs?: string;
  phoneticUk?: string;
  ukNote?: string;
  colloquial: string[];
  exampleEn: string;
  examplePt: string;
  exampleEn2?: string;
  examplePt2?: string;
  tip: string;
  status: CardStatus;
  origin?: CardOrigin;
  archived?: boolean;
  published?: boolean;
  authorId?: string;
  selectedForStudy?: boolean;
  modified?: boolean;
  updatedAt?: number;
  linguisticAuditV3?: boolean;
}

export interface UserDeck {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  colorTag: DeckColorTag;
  cardIds: string[];
  updatedAt?: number;
}

export interface CardProgressEntry {
  cardId: string;
  masteryLevel: CardStatus;
  roundMarked: number;
  updatedAt?: string;
}

export interface AdminRecord {
  uid: string;
  grantedBy: string;
  label: string;
}

export interface SecondExamplePair {
  en: string;
  pt: string;
}

export interface LexiconEntry {
  term?: string;
  enAlternatives?: string[];
  category?: string;
  subtopic?: string;
  literal: string;
  colloquial: string[];
  exampleEn: string;
  examplePt: string;
  exampleEn2?: string;
  examplePt2?: string;
  tip: string;
}

export interface GrammarAuditResult {
  valid: boolean;
  ruleCode: string;
  reason: string;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  card: Flashcard;
  options: QuizOption[];
}
