import {
  AI_COLLOQUIAL_KB,
  INITIAL_CARDS,
  SECOND_EXAMPLES_MAP,
  SUBTOPIC_BY_ID,
  TEACHER_MASTER_LEXICON,
  TOPIC_BY_ID,
  VALID_FOLDERS,
  VALID_SUBTOPICS,
} from '../data/seedData';
import type {
  CardProgressEntry,
  DeckColorTag,
  EnglishAccent,
  Flashcard,
  ListSelectionFilter,
  QuizOption,
  QuizQuestion,
  SecondExamplePair,
  StatusFilter,
  StudyScope,
  SubtopicKey,
  TopicFolder,
  UserDeck,
} from '../types/flashcard';
import { isGenericTemplateSentence } from './grammarEngine';
import { getCardPhonetics } from './phonetics';

export const VIRTUAL_DECK_OFFICIAL_ID = '__official__';
export const VIRTUAL_DECK_CUSTOM_ID = '__custom__';

const FIRESTORE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && FIRESTORE_ID_REGEX.test(id);
}

const PHRASAL_PARTICLES = new Set([
  'up',
  'down',
  'out',
  'in',
  'on',
  'off',
  'over',
  'away',
  'back',
  'into',
  'after',
  'through',
  'around',
  'along',
  'aside',
  'by',
  'for',
  'with',
  'to',
  'behind',
  'across',
  'apart',
  'forward',
]);

const KNOWN_PHRASAL_VERBS = new Set([
  'get up', 'look for', 'come on', 'turn on', 'turn off', 'sum up', 'to sum up',
  'hold on', 'fall behind', 'act up', 'add up', 'ask out', 'back down', 'back out',
  'back up', 'bail out', 'bear with', 'blow up', 'brush up on', 'bump into', 'burn out',
  'call back', 'calm down', 'carry on', 'carry out', 'catch on', 'check in', 'check out',
  'cheer up', 'chicken out', 'chip in', 'come across', 'come down with', 'come over',
  'come through', 'cut back on', 'cut off', 'do over', 'drop by', 'drop out', 'eat out',
  'fall for', 'fall through', 'fill in', 'follow up', 'get across', 'get around to',
  'get by', 'get down to', 'get out of', 'get through', 'give away', 'go ahead',
  'go off', 'go over', 'go through', 'grow on', 'hand in', 'hang in there', 'hang up',
  'head out', 'hold off', 'hold up', 'iron out', 'keep on', 'kick off', 'lay off',
  'leave out', 'let off', 'live up to', 'look down on', 'look up to', 'make out',
  'make up for', 'mix up', 'narrow down', 'open up', 'pan out', 'pass away', 'pass up',
  'pay off', 'pick out', 'pile up', 'pull over', 'put aside', 'put on', 'put out',
  'reach out', 'rip off', 'rule out', 'run over', 'see through', 'settle down',
  'settle for', 'shake off', 'sleep on it', 'slip up', 'sort out', 'speak up',
  'spell out', 'stand out', 'stand up for', 'step up', 'stick around', 'stick to',
  'take after', 'take back', 'take in', 'take on', 'take up', 'talk into', 'think over',
  'throw away', 'try on', 'turn around', 'turn in', 'turn up', 'wear off', 'wear out',
  'wind down', 'wind up', 'work on', 'wrap up', 'zone out', 'give up', 'put up with',
  'run out of', 'look forward to', 'come up with', 'turn down', 'get over', 'call off',
  'bring up', 'find out', 'make up', 'put off', 'take off', 'work out', 'break down',
  'run into', 'show up', 'let down', 'look after', 'look into', 'get along',
  'get away with', 'catch up', 'drop off', 'fall apart', 'fill out', 'give in',
  'go on', 'hang out', 'keep up with', 'look up', 'pass out', 'pick up', 'point out',
  'set up', 'show off', 'take over', 'turn out', 'watch out', 'freak out', 'mess up',
  'move on', 'pull off', 'end up', 'count on', 'deal with', 'get rid of', 'hold back',
  'figure out', 'feel like',
]);

export function classifyTermIntoFolder(term: string, cardId = ''): TopicFolder {
  if (cardId && String(cardId).startsWith('mari_')) {
    return 'Dicas da Mari';
  }
  const cleaned = String(term || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[.!?"'“”]/g, '')
    .trim();
  const lower = cleaned.toLowerCase().replace(/^to\s+/, '').trim();
  if (!lower) return 'Frases';

  if (KNOWN_PHRASAL_VERBS.has(lower) || KNOWN_PHRASAL_VERBS.has(cleaned.toLowerCase())) {
    return 'Phrasal Verbs';
  }

  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return 'Palavras';
  }

  if (words.length >= 2 && words.length <= 3) {
    const secondWord = words[1];
    const lastWord = words[words.length - 1];
    const nonVerbStarters = new Set([
      'from', 'at', 'on', 'in', 'by', 'out', 'under', 'up', 'soon', 'pretty',
      'long', 'no', 'we', 'where', 'legal', 'mock', 'tectonic', 'piece', 'rain',
    ]);
    if (
      !nonVerbStarters.has(words[0]) &&
      (PHRASAL_PARTICLES.has(secondWord) || PHRASAL_PARTICLES.has(lastWord))
    ) {
      return 'Phrasal Verbs';
    }
  }

  return 'Frases';
}

export function normalizeCardFolder(card: Partial<Flashcard>): TopicFolder {
  if (!card) return 'Frases';
  if (card.id && TOPIC_BY_ID[card.id] && !card.modified) {
    return TOPIC_BY_ID[card.id];
  }
  if (card.id && String(card.id).startsWith('mari_') && !card.modified) {
    return 'Dicas da Mari';
  }
  if (card.id && String(card.id).startsWith('pv_') && !card.modified) {
    return 'Phrasal Verbs';
  }
  const current = String(card.category || '').trim();
  const matchedValid = VALID_FOLDERS.find((f) => f.toLowerCase() === current.toLowerCase());
  if (matchedValid) {
    return matchedValid;
  }
  return classifyTermIntoFolder(card.term || '', card.id);
}

export function classifyCardSubtopic(card: Partial<Flashcard>): SubtopicKey {
  if (!card) return 'Casual';
  const rawSub = String(card.subtopic || '');
  if (rawSub === 'Viagem') return 'Viagens';
  if (rawSub === 'Rotina' || rawSub === 'Conversa') return 'Casual';
  if (card.id && SUBTOPIC_BY_ID[card.id] && !card.modified) {
    return SUBTOPIC_BY_ID[card.id];
  }
  if (card.subtopic && VALID_SUBTOPICS.some((s) => s.key === card.subtopic)) {
    return card.subtopic;
  }
  if (card.id && SUBTOPIC_BY_ID[card.id]) {
    return SUBTOPIC_BY_ID[card.id];
  }
  const text = `${card.term || ''} ${card.literal || ''} ${card.exampleEn || ''}`.toLowerCase();
  if (
    /(flight|airport|boarding|luggage|hotel|reservation|check-in|check in|check-out|passport|trip|travel|take off|tourist|visa)/.test(
      text
    )
  ) {
    return 'Viagens';
  }
  if (/(weather|sunny|rain|hot|cold|freezing|cloudy|storm|winter|summer|temperature)/.test(text)) {
    return 'Clima';
  }
  if (
    /(work|job|office|meeting|project|manager|boss|client|contract|report|exam|test|grade|study|class|reschedule|schedule|business|career)/.test(
      text
    )
  ) {
    return 'Trabalho';
  }
  if (
    /(coffee|food|eat|hungry|thirsty|restaurant|menu|pasta|water|delicious|bill|check|pizza|party|game|play|movie|music|beach|bite)/.test(
      text
    )
  ) {
    return 'Lazer';
  }
  return 'Casual';
}

export function hydrateCard(card: Flashcard): Flashcard {
  const phonetics = getCardPhonetics(card);
  return {
    ...card,
    phoneticUs: card.phoneticUs || phonetics.us,
    phoneticUk: card.phoneticUk || phonetics.uk,
    ukNote: card.ukNote ?? (phonetics.ukNote || undefined),
    category: normalizeCardFolder(card),
    subtopic: classifyCardSubtopic(card),
    colloquial: Array.isArray(card.colloquial) ? card.colloquial : [],
    status: card.status || 'unseen',
    origin: card.origin || (String(card.id || '').startsWith('custom_') ? 'custom' : 'seed'),
  };
}

export function getCardSecondExample(card: Flashcard): SecondExamplePair {
  if (!card) return { en: '', pt: '' };
  if (SECOND_EXAMPLES_MAP[card.id]) {
    if (card.exampleEn2 && card.exampleEn2.trim() && !isGenericTemplateSentence(card.exampleEn2)) {
      return {
        en: card.exampleEn2.trim(),
        pt: (card.examplePt2 || '').trim() || SECOND_EXAMPLES_MAP[card.id].pt,
      };
    }
    return SECOND_EXAMPLES_MAP[card.id];
  }
  if (card.exampleEn2 && card.exampleEn2.trim() && !isGenericTemplateSentence(card.exampleEn2)) {
    return {
      en: card.exampleEn2.trim(),
      pt:
        (card.examplePt2 || '').trim() ||
        `→ "${(card.colloquial && card.colloquial[0]) || card.literal}"`,
    };
  }

  const cleanTerm = String(card.term || '').replace(/\([^)]*\)/g, '').trim();
  const lower = cleanTerm.toLowerCase().replace(/[.!?]+$/, '').replace(/^to\s+/, '');

  const matchInit = INITIAL_CARDS.find(
    (c) =>
      c.id === card.id ||
      String(c.term || '')
        .toLowerCase()
        .replace(/[.!?]+$/, '')
        .replace(/^to\s+/, '') === lower
  );
  if (matchInit?.exampleEn2) {
    return { en: matchInit.exampleEn2, pt: matchInit.examplePt2 || '' };
  }

  const kb = AI_COLLOQUIAL_KB[lower] || TEACHER_MASTER_LEXICON[lower];
  if (kb?.exampleEn2) {
    return { en: kb.exampleEn2, pt: kb.examplePt2 || '' };
  }

  return { en: card.exampleEn || '', pt: card.examplePt || '' };
}

export function mergeCatalogAndUserCards(params: {
  seedCards?: Flashcard[];
  globalCards: Flashcard[];
  customCards: Flashcard[];
  progressMap: Record<string, CardProgressEntry>;
  localDeletedIds?: Set<string>;
}): Flashcard[] {
  const {
    seedCards = INITIAL_CARDS,
    globalCards,
    customCards,
    progressMap,
    localDeletedIds = new Set<string>(),
  } = params;

  const globalById = new Map<string, Flashcard>();
  for (const gc of globalCards) {
    if (gc && gc.id) {
      globalById.set(gc.id, gc);
    }
  }

  const seedIds = new Set(seedCards.map((c) => c.id));
  const merged: Flashcard[] = [];
  const seenIds = new Set<string>();

  const applyProgress = (card: Flashcard): Flashcard => {
    const prog = progressMap[card.id];
    const status = prog ? prog.masteryLevel : card.status || 'unseen';
    return hydrateCard({ ...card, status });
  };

  // 1. Student's own custom cards first
  for (const cc of customCards) {
    if (!cc?.id || seenIds.has(cc.id) || localDeletedIds.has(cc.id)) continue;
    seenIds.add(cc.id);
    merged.push(applyProgress({ ...cc, origin: 'custom', modified: true }));
  }

  // 2. Brand-new Official Broadcast cards created by Admin (not overriding seed IDs)
  for (const gc of globalCards) {
    if (!gc?.id || seedIds.has(gc.id) || seenIds.has(gc.id)) continue;
    if (gc.archived || localDeletedIds.has(gc.id)) continue;
    seenIds.add(gc.id);
    merged.push(applyProgress({ ...gc, origin: 'global', modified: true }));
  }

  // 3. Built-in 172 Seed cards (with optional Admin override or archive)
  for (const sc of seedCards) {
    if (!sc?.id || seenIds.has(sc.id) || localDeletedIds.has(sc.id)) continue;
    const override = globalById.get(sc.id);
    if (override) {
      if (override.archived) continue;
      seenIds.add(sc.id);
      merged.push(
        applyProgress({
          ...sc,
          ...override,
          origin: 'global',
          modified: true,
        })
      );
    } else {
      seenIds.add(sc.id);
      merged.push(applyProgress({ ...sc, origin: 'seed' }));
    }
  }

  return merged;
}

export function resolveConnectedDecksCards(params: {
  allCards: Flashcard[];
  connectedDeckIds: string[];
  userDecks: UserDeck[];
}): Flashcard[] {
  const { allCards, connectedDeckIds, userDecks } = params;
  if (!connectedDeckIds || connectedDeckIds.length === 0) {
    return [];
  }

  const cardById = new Map(allCards.map((c) => [c.id, c]));
  const deckById = new Map(userDecks.map((d) => [d.id, d]));
  const seenIds = new Set<string>();
  const resolved: Flashcard[] = [];

  const pushUnique = (card: Flashcard | undefined) => {
    if (!card || seenIds.has(card.id)) return;
    seenIds.add(card.id);
    resolved.push(card);
  };

  for (const deckId of connectedDeckIds) {
    if (deckId === VIRTUAL_DECK_CUSTOM_ID) {
      for (const c of allCards) {
        if (c.origin === 'custom') pushUnique(c);
      }
    } else if (deckId === VIRTUAL_DECK_OFFICIAL_ID) {
      for (const c of allCards) {
        if (c.origin !== 'custom') pushUnique(c);
      }
    } else {
      const deck = deckById.get(deckId);
      if (!deck) continue;
      for (const cid of deck.cardIds || []) {
        pushUnique(cardById.get(cid));
      }
    }
  }

  return resolved;
}

export function normalizeSearchText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function filterStudyCards(params: {
  cards: Flashcard[];
  selectedStudyIds: Set<string>;
  connectedCardIds?: Set<string>;
  studyScope: StudyScope;
  selectedCategory: 'all' | TopicFolder;
  selectedSubtopic: 'all' | SubtopicKey;
  selectedStatus: StatusFilter;
}): Flashcard[] {
  const {
    cards,
    selectedStudyIds,
    connectedCardIds = new Set<string>(),
    studyScope,
    selectedCategory,
    selectedSubtopic,
    selectedStatus,
  } = params;

  return cards.filter((c) => {
    if (studyScope === 'selected' && !selectedStudyIds.has(c.id)) return false;
    if (studyScope === 'decks' && !connectedCardIds.has(c.id)) return false;
    const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
    const matchSub = selectedSubtopic === 'all' || c.subtopic === selectedSubtopic;
    const matchStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'mastered' && c.status === 'mastered') ||
      (selectedStatus === 'review' && c.status === 'review') ||
      (selectedStatus === 'unseen' && c.status !== 'mastered');
    return matchCat && matchSub && matchStatus;
  });
}

export function filterListCards(params: {
  cards: Flashcard[];
  selectedStudyIds: Set<string>;
  selectedCategory: 'all' | TopicFolder;
  selectedSubtopic: 'all' | SubtopicKey;
  selectedStatus: StatusFilter;
  listSelectionFilter: ListSelectionFilter;
  searchQuery: string;
}): Flashcard[] {
  const {
    cards,
    selectedStudyIds,
    selectedCategory,
    selectedSubtopic,
    selectedStatus,
    listSelectionFilter,
    searchQuery,
  } = params;
  const q = normalizeSearchText(searchQuery);
  return cards.filter((c) => {
    const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
    const matchSub = selectedSubtopic === 'all' || c.subtopic === selectedSubtopic;
    const matchStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'mastered' && c.status === 'mastered') ||
      (selectedStatus === 'review' && c.status === 'review') ||
      (selectedStatus === 'unseen' && c.status !== 'mastered');
    const isSel = selectedStudyIds.has(c.id);
    const matchSelection =
      listSelectionFilter === 'all' ||
      (listSelectionFilter === 'selected' && isSel) ||
      (listSelectionFilter === 'unselected' && !isSel);
    if (!q) return matchCat && matchSub && matchStatus && matchSelection;

    const secEx = getCardSecondExample(c);
    const phon = getCardPhonetics(c);
    const haystack = normalizeSearchText(
      [
        c.term,
        c.literal,
        phon.us,
        phon.uk,
        phon.ukNote || '',
        ...(c.colloquial || []),
        c.exampleEn,
        c.examplePt,
        secEx.en,
        secEx.pt,
        c.tip,
        c.category,
        c.subtopic,
      ].join(' ')
    );
    return matchCat && matchSub && matchStatus && matchSelection && haystack.includes(q);
  });
}

export function computeFolderAndSubtopicCounts(
  cards: Flashcard[],
  selectedCategory: 'all' | TopicFolder,
  selectedSubtopic: 'all' | SubtopicKey
) {
  const folderCounts: Record<string, number> = { all: 0 };
  VALID_FOLDERS.forEach((f) => {
    folderCounts[f] = 0;
  });
  cards.forEach((c) => {
    if (selectedSubtopic === 'all' || c.subtopic === selectedSubtopic) {
      folderCounts.all++;
      folderCounts[c.category] = (folderCounts[c.category] || 0) + 1;
    }
  });

  const subtopicCounts: Record<string, number> = { all: 0 };
  VALID_SUBTOPICS.forEach((st) => {
    subtopicCounts[st.key] = 0;
  });
  cards.forEach((c) => {
    if (selectedCategory === 'all' || c.category === selectedCategory) {
      subtopicCounts.all++;
      subtopicCounts[c.subtopic] = (subtopicCounts[c.subtopic] || 0) + 1;
    }
  });

  return { folderCounts, subtopicCounts };
}

export function buildColloquialVariations(
  literalPt: string,
  _rawTerm: string,
  extraCandidates: string[] = []
): string[] {
  const clean = String(literalPt || '')
    .replace(/[.!?]+$/, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  const suggestions: string[] = [];

  const addCleanOption = (opt: string) => {
    if (!opt || typeof opt !== 'string') return;
    let c = opt.replace(/[.!?]+$/, '').trim();
    if (!c || c.length < 2 || c.length > 65) return;
    if (
      /^(mandar o |no sentido de |na prática:|mandar a real \(|sentido de |sentido direto de )/i.test(
        c
      )
    ) {
      return;
    }
    c = c.charAt(0).toUpperCase() + c.slice(1);
    if (!suggestions.some((s) => s.toLowerCase() === c.toLowerCase())) {
      suggestions.push(c);
    }
  };

  clean.split(/[\/,;]/).forEach((part) => addCleanOption(part));
  (extraCandidates || []).forEach((cand) => addCleanOption(cand));

  const teacherSynonymsMap: [RegExp, string[]][] = [
    [/^compreender$/i, ['Entender', 'Captar a ideia', 'Sacar']],
    [/^entender$/i, ['Compreender', 'Pegar a ideia', 'Sacar']],
    [/^esperar$/i, ['Aguardar', 'Segurar um instante', 'Ter paciência']],
    [/^desistir$/i, ['Abrir mão', 'Largar mão', 'Jogar a toalha']],
    [/^continuar$/i, ['Prosseguir', 'Seguir em frente', 'Tocar o barco']],
    [/^começar$/i, ['Iniciar', 'Dar início', 'Dar o pontapé inicial']],
    [/^terminar$/i, ['Concluir', 'Finalizar', 'Encerrar']],
    [/^tentar$/i, ['Experimentar', 'Fazer uma tentativa', 'Arriscar']],
    [/^difícil$/i, ['Complicado', 'Desafiador', 'Puxado']],
    [/^fácil$/i, ['Simples', 'Tranquilo de fazer', 'Moleza']],
    [/^muito bom$/i, ['Excelente', 'De primeira', 'Ótimo']],
    [/^cansado$/i, ['Exausto', 'Esgotado', 'Sem energia']],
    [/^rápido$/i, ['Depressa', 'Rapidinho', 'Em pouco tempo']],
    [/^conversar$/i, ['Bater um papo', 'Trocar uma ideia', 'Dialogar']],
    [/^ajudar$/i, ['Dar uma força', 'Auxiliar', 'Quebrar um galho']],
    [/^problema$/i, ['Imprevisto', 'Dificuldade', 'Contratempo']],
    [/^adiar$/i, ['Remarcar', 'Deixar para depois', 'Postergar']],
    [/^cancelar$/i, ['Desmarcar', 'Suspender']],
    [/^descobrir$/i, ['Ficar sabendo', 'Desvendar', 'Encontrar a resposta']],
    [/^procurar$/i, ['Buscar', 'Ir atrás de']],
  ];

  const baseCopy = [...suggestions];
  baseCopy.forEach((item) => {
    teacherSynonymsMap.forEach(([regex, alts]) => {
      if (regex.test(item)) {
        alts.forEach((a) => addCleanOption(a));
      }
    });
  });

  if (suggestions.length === 0 && clean) {
    suggestions.push(clean.charAt(0).toUpperCase() + clean.slice(1));
  }

  return suggestions.slice(0, 4);
}

export function generateQuizQuestion(
  cards: Flashcard[],
  selectedCategory: 'all' | TopicFolder,
  selectedSubtopic: 'all' | SubtopicKey,
  previousCardId?: string
): QuizQuestion | null {
  const allCards = cards.length >= 4 ? cards : INITIAL_CARDS;
  if (allCards.length < 4) return null;

  const filteredByTopic = allCards.filter((c) => {
    const mCat = selectedCategory === 'all' || c.category === selectedCategory;
    const mSub = selectedSubtopic === 'all' || c.subtopic === selectedSubtopic;
    return mCat && mSub;
  });

  const basePool = filteredByTopic.length >= 4 ? filteredByTopic : allCards;
  const nonRepeatPool =
    previousCardId && basePool.length > 1
      ? basePool.filter((c) => c.id !== previousCardId)
      : basePool;
  const correctCard = nonRepeatPool[Math.floor(Math.random() * nonRepeatPool.length)];
  const correctText =
    (correctCard.colloquial || []).slice(0, 2).join(' / ') || correctCard.literal;

  const distractorPool = allCards.filter(
    (c) =>
      c.id !== correctCard.id &&
      ((c.colloquial || []).slice(0, 2).join(' / ') || c.literal).toLowerCase() !==
        correctText.toLowerCase()
  );
  const shuffledOthers = [...distractorPool].sort(() => Math.random() - 0.5);
  const chosenDistractors: Flashcard[] = [];
  const seenOptionTexts = new Set([correctText.toLowerCase()]);

  for (const cand of shuffledOthers) {
    if (chosenDistractors.length >= 3) break;
    const txt = (cand.colloquial || []).slice(0, 2).join(' / ') || cand.literal;
    if (!seenOptionTexts.has(txt.toLowerCase())) {
      seenOptionTexts.add(txt.toLowerCase());
      chosenDistractors.push(cand);
    }
  }

  const options: QuizOption[] = [
    {
      id: correctCard.id,
      text: correctText,
      isCorrect: true,
    },
    ...chosenDistractors.map((o) => ({
      id: o.id,
      text: (o.colloquial || []).slice(0, 2).join(' / ') || o.literal,
      isCorrect: false,
    })),
  ].sort(() => Math.random() - 0.5);

  return { card: correctCard, options };
}

export function exportCardsToCsv(cards: Flashcard[]): string {
  const escapeCell = (val: unknown) => {
    const str = String(val ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
    return `"${str}"`;
  };
  const header = [
    'ID',
    'Expressão',
    'Tópico',
    'Subtópico',
    'Sentido Literal',
    'Fonética US (EWM-US)',
    'Fonética UK (EWM-UK)',
    'Nota US/UK',
    'Traduções Coloquiais',
    'Exemplo 1 (EN)',
    'Exemplo 1 (PT)',
    'Exemplo 2 (EN)',
    'Exemplo 2 (PT)',
    'Dica',
    'Status',
  ].join(',');

  const rows = cards.map((c) => {
    const sec = getCardSecondExample(c);
    const phon = getCardPhonetics(c);
    return [
      escapeCell(c.id),
      escapeCell(c.term),
      escapeCell(c.category),
      escapeCell(c.subtopic),
      escapeCell(phon.meaning),
      escapeCell(phon.us),
      escapeCell(phon.uk),
      escapeCell(phon.ukNote || ''),
      escapeCell((c.colloquial || []).join(' | ')),
      escapeCell(c.exampleEn),
      escapeCell(c.examplePt),
      escapeCell(sec.en),
      escapeCell(sec.pt),
      escapeCell(c.tip),
      escapeCell(c.status),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

export function extractPhoneticNotation(literal: string): {
  meaning: string;
  phonetic: string | null;
} {
  const raw = String(literal || '').trim();
  const markerMatch = raw.match(/\(Pronúncia:\s*/i);
  if (!markerMatch || markerMatch.index === undefined) {
    return { meaning: raw, phonetic: null };
  }
  const startIdx = markerMatch.index;
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < raw.length; i++) {
    if (raw[i] === '(') depth++;
    else if (raw[i] === ')') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    return { meaning: raw, phonetic: null };
  }
  const inner = raw.slice(startIdx + markerMatch[0].length, endIdx).trim();
  const meaning = (raw.slice(0, startIdx) + raw.slice(endIdx + 1)).replace(/\s+/g, ' ').trim();
  return { meaning, phonetic: inner || null };
}

/**
 * Defensive Payload Sanitizers synchronized with firebase-blueprint.json & firestore.rules
 */
export function sanitizeCardFieldsForFirestore(card: Partial<Flashcard> & { id?: string }) {
  const term = String(card.term || '').trim().slice(0, 140) || 'Expression';
  const category = normalizeCardFolder(card);
  const subtopic = classifyCardSubtopic(card);
  const rawColloquial = Array.isArray(card.colloquial) ? card.colloquial : [];
  const colloquial = rawColloquial
    .map((s) => String(s || '').trim().slice(0, 90))
    .filter((s) => s.length >= 1)
    .slice(0, 8);
  if (colloquial.length === 0) {
    colloquial.push(String(card.literal || term).trim().slice(0, 90) || term.slice(0, 90));
  }

  const literal = (String(card.literal || '').trim() || colloquial[0]).slice(0, 240);
  const sec = card.id ? getCardSecondExample(card as Flashcard) : { en: '', pt: '' };

  let exampleEn = String(card.exampleEn || '').trim().slice(0, 260);
  if (exampleEn.length < 12) {
    exampleEn = `${exampleEn || term} in everyday conversation.`.slice(0, 260);
  }
  let examplePt = String(card.examplePt || '').trim().slice(0, 260);
  if (examplePt.length < 2) {
    examplePt = `→ ${colloquial[0]}`.slice(0, 260);
  }

  let exampleEn2 = String(card.exampleEn2 || sec.en || exampleEn).trim().slice(0, 260);
  if (exampleEn2.length < 12) {
    exampleEn2 = exampleEn;
  }
  let examplePt2 = String(card.examplePt2 || sec.pt || examplePt).trim().slice(0, 260);
  if (examplePt2.length < 2) {
    examplePt2 = examplePt;
  }

  const tip = String(card.tip || '').trim().slice(0, 400);
  const resolvedPhonetics = getCardPhonetics({
    id: card.id || '',
    term,
    literal,
    phoneticUs: card.phoneticUs,
    phoneticUk: card.phoneticUk,
    ukNote: card.ukNote,
  });

  const phoneticUs = String(card.phoneticUs || resolvedPhonetics.us || '')
    .trim()
    .slice(0, 160);
  const phoneticUk = String(card.phoneticUk || resolvedPhonetics.uk || '')
    .trim()
    .slice(0, 160);
  const ukNote = String(card.ukNote ?? resolvedPhonetics.ukNote ?? '')
    .trim()
    .slice(0, 240);

  return {
    term,
    category,
    subtopic,
    literal,
    phoneticUs,
    phoneticUk,
    ukNote,
    colloquial,
    exampleEn,
    examplePt,
    exampleEn2,
    examplePt2,
    tip,
  };
}

export function sanitizeDeckFieldsForFirestore(deck: Partial<UserDeck>) {
  const name = (String(deck.name || '').trim() || 'Meu Baralho').slice(0, 80);
  const description = String(deck.description || '').trim().slice(0, 240);
  const allowedColors: DeckColorTag[] = ['sage', 'ochre', 'slate', 'terracotta'];
  const colorTag: DeckColorTag = allowedColors.includes(deck.colorTag as DeckColorTag)
    ? (deck.colorTag as DeckColorTag)
    : 'sage';
  const seen = new Set<string>();
  const cardIds: string[] = [];
  for (const rawId of deck.cardIds || []) {
    const cleanId = String(rawId || '').trim();
    if (isValidFirestoreId(cleanId) && !seen.has(cleanId)) {
      seen.add(cleanId);
      cardIds.push(cleanId);
      if (cardIds.length >= 200) break;
    }
  }
  return { name, description, colorTag, cardIds };
}

export function sanitizeWorkspaceFieldsForFirestore(params: {
  studyScope: StudyScope;
  selectedCardIds: string[];
  connectedDeckIds: string[];
  activeRound: number;
  preferredAccent?: EnglishAccent;
}) {
  const validScopes: StudyScope[] = ['selected', 'decks', 'all'];
  const studyScope: StudyScope = validScopes.includes(params.studyScope)
    ? params.studyScope
    : 'selected';

  const selectedCardIds = Array.from(new Set(params.selectedCardIds || []))
    .filter((id) => isValidFirestoreId(id))
    .slice(0, 20);

  const connectedDeckIds = Array.from(new Set(params.connectedDeckIds || []))
    .filter((id) => isValidFirestoreId(id))
    .slice(0, 12);

  const activeRound = Math.max(1, Math.min(10000, Math.floor(params.activeRound || 1)));
  const preferredAccent: EnglishAccent = params.preferredAccent === 'uk' ? 'uk' : 'us';

  return {
    studyScope,
    selectedCardIds,
    connectedDeckIds,
    activeRound,
    preferredAccent,
  };
}
