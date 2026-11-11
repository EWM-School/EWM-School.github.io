import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STARTER_STUDY_IDS,
  INITIAL_CARDS,
  VALID_FOLDERS,
  VALID_SUBTOPICS,
} from '../data/seedData';
import type { Flashcard, UserDeck } from '../types/flashcard';
import {
  buildColloquialVariations,
  classifyCardSubtopic,
  classifyTermIntoFolder,
  computeFolderAndSubtopicCounts,
  exportCardsToCsv,
  extractPhoneticNotation,
  filterListCards,
  filterStudyCards,
  generateQuizQuestion,
  getCardSecondExample,
  hydrateCard,
  isValidFirestoreId,
  mergeCatalogAndUserCards,
  normalizeSearchText,
  resolveConnectedDecksCards,
  sanitizeCardFieldsForFirestore,
  sanitizeDeckFieldsForFirestore,
  sanitizeWorkspaceFieldsForFirestore,
  VIRTUAL_DECK_CUSTOM_ID,
  VIRTUAL_DECK_OFFICIAL_ID,
} from './deckHelpers';

test('INITIAL_CARDS contains all 172 cards with valid folders, subtopics, and 2nd examples', () => {
  assert.equal(INITIAL_CARDS.length, 172);

  const hydrated = INITIAL_CARDS.map(hydrateCard);
  for (const card of hydrated) {
    assert.ok(VALID_FOLDERS.includes(card.category), `Invalid folder for ${card.id}: ${card.category}`);
    assert.ok(
      VALID_SUBTOPICS.some((s) => s.key === card.subtopic),
      `Invalid subtopic for ${card.id}: ${card.subtopic}`
    );
    const sec = getCardSecondExample(card);
    assert.ok(sec.en.length > 0, `Missing second example EN for ${card.id}`);
    assert.ok(sec.pt.length > 0, `Missing second example PT for ${card.id}`);
  }

  for (const starterId of DEFAULT_STARTER_STUDY_IDS) {
    assert.ok(
      hydrated.some((c) => c.id === starterId),
      `Starter ID ${starterId} missing from INITIAL_CARDS`
    );
  }
});

test('classifyTermIntoFolder accurately routes Mari tips, Phrasal Verbs, Palavras, and Frases', () => {
  assert.equal(classifyTermIntoFolder('Reschedule', 'mari_10'), 'Dicas da Mari');
  assert.equal(classifyTermIntoFolder('Bring up'), 'Phrasal Verbs');
  assert.equal(classifyTermIntoFolder('Witness'), 'Palavras');
  assert.equal(classifyTermIntoFolder('Cut to the chase'), 'Frases');
});

test('classifyCardSubtopic recognizes domain keywords when card is unmapped', () => {
  assert.equal(
    classifyCardSubtopic({ term: 'Boarding pass', literal: 'Cartão de embarque', exampleEn: 'Show your passport at the airport.' }),
    'Viagens'
  );
  assert.equal(
    classifyCardSubtopic({ term: 'Deadline', literal: 'Prazo', exampleEn: 'The manager moved the project meeting.' }),
    'Trabalho'
  );
  assert.equal(
    classifyCardSubtopic({ term: 'Drizzle', literal: 'Chuvisco', exampleEn: 'The weather forecast says light rain.' }),
    'Clima'
  );
});

test('accent-insensitive search and cross-filters work together accurately', () => {
  const hydrated = INITIAL_CARDS.map(hydrateCard);
  assert.equal(normalizeSearchText('Ação Coloquial!'), 'acao coloquial!');

  const selectedIds = new Set(DEFAULT_STARTER_STUDY_IDS);
  const studyFiltered = filterStudyCards({
    cards: hydrated,
    selectedStudyIds: selectedIds,
    studyScope: 'selected',
    selectedCategory: 'all',
    selectedSubtopic: 'all',
    selectedStatus: 'all',
  });
  assert.equal(studyFiltered.length, DEFAULT_STARTER_STUDY_IDS.length);

  const searchResult = filterListCards({
    cards: hydrated,
    selectedStudyIds: selectedIds,
    selectedCategory: 'all',
    selectedSubtopic: 'all',
    selectedStatus: 'all',
    listSelectionFilter: 'all',
    searchQuery: 'resumir a opera',
  });
  assert.ok(searchResult.some((c) => c.id === 'c1'));

  const counts = computeFolderAndSubtopicCounts(hydrated, 'all', 'all');
  assert.equal(counts.folderCounts.all, 172);
  assert.equal(counts.subtopicCounts.all, 172);
});

test('mergeCatalogAndUserCards merges custom cards, Admin global broadcasts, overrides, and mastery progress', () => {
  const adminBroadcast: Flashcard = {
    id: 'global_999',
    term: 'Touch base',
    category: 'Frases',
    subtopic: 'Trabalho',
    literal: 'Alinhar rapidamente',
    colloquial: ['Alinhar os ponteiros', 'Trocar uma ideia rápida'],
    exampleEn: "Let's touch base tomorrow morning before the client call.",
    examplePt: 'Vamos alinhar os ponteiros amanhã cedo antes da call com o cliente.',
    exampleEn2: 'I just wanted to touch base on the project timeline.',
    examplePt2: 'Eu só queria alinhar rapidamente sobre o cronograma do projeto.',
    tip: 'Expressão clássica do ambiente corporativo nos EUA.',
    status: 'unseen',
    origin: 'global',
    published: true,
    archived: false,
  };

  const archivedSeedOverride: Flashcard = {
    ...INITIAL_CARDS[1],
    id: 'c2',
    archived: true,
    published: true,
    origin: 'global',
  };

  const studentCustom: Flashcard = {
    id: 'custom_abc',
    term: 'Play it by ear',
    category: 'Frases',
    subtopic: 'Casual',
    literal: 'Improvisar conforme a situação',
    colloquial: ['Ver na hora', 'Ir sentindo o clima'],
    exampleEn: "We don't have a strict plan yet, so let's play it by ear.",
    examplePt: 'Ainda não temos um plano fechado, então vamos ver na hora.',
    tip: 'Muito natural para viagens e planos casuais.',
    status: 'unseen',
    origin: 'custom',
  };

  const merged = mergeCatalogAndUserCards({
    seedCards: INITIAL_CARDS.slice(0, 5),
    globalCards: [adminBroadcast, archivedSeedOverride],
    customCards: [studentCustom],
    progressMap: {
      c1: { cardId: 'c1', masteryLevel: 'mastered', roundMarked: 2 },
      custom_abc: { cardId: 'custom_abc', masteryLevel: 'review', roundMarked: 1 },
    },
  });

  // 5 seed cards - 1 archived ('c2') + 1 global ('global_999') + 1 custom ('custom_abc') = 6
  assert.equal(merged.length, 6);
  assert.equal(merged[0].id, 'custom_abc');
  assert.equal(merged[0].status, 'review');
  assert.equal(merged[1].id, 'global_999');
  assert.ok(!merged.some((c) => c.id === 'c2'), 'Archived seed card c2 should be hidden');
  assert.equal(merged.find((c) => c.id === 'c1')?.status, 'mastered');
});

test('resolveConnectedDecksCards mixes student custom cards + official cards and connects multiple decks without duplicates', () => {
  const customCard: Flashcard = hydrateCard({
    id: 'custom_1',
    term: 'Keep me posted',
    category: 'Frases',
    subtopic: 'Trabalho',
    literal: 'Me mantenha informado',
    colloquial: ['Me avisa de qualquer novidade', 'Me mantém a par'],
    exampleEn: 'Keep me posted if the flight gate changes.',
    examplePt: 'Me avisa se o portão do voo mudar.',
    tip: 'Muito usado em mensagens rápidas.',
    status: 'unseen',
    origin: 'custom',
  });

  const allCards = [customCard, ...INITIAL_CARDS.slice(0, 5).map(hydrateCard)];

  const deckA: UserDeck = {
    id: 'deck_viagem',
    ownerId: 'uid_student',
    name: 'Imersão Viagem + Minhas Palavras',
    description: 'Mistura de cartas minhas com cartas oficiais',
    colorTag: 'sage',
    cardIds: ['custom_1', 'c1', 'c3'],
  };

  const deckB: UserDeck = {
    id: 'deck_reuniao',
    ownerId: 'uid_student',
    name: 'Reuniões em Inglês',
    description: 'Expressões para calls',
    colorTag: 'ochre',
    cardIds: ['c3', 'c4'], // 'c3' overlaps with deckA!
  };

  const connected = resolveConnectedDecksCards({
    allCards,
    connectedDeckIds: ['deck_viagem', 'deck_reuniao'],
    userDecks: [deckA, deckB],
  });

  assert.deepEqual(
    connected.map((c) => c.id),
    ['custom_1', 'c1', 'c3', 'c4']
  );

  // Also test connecting virtual __custom__ + deckB
  const connectedWithVirtual = resolveConnectedDecksCards({
    allCards,
    connectedDeckIds: [VIRTUAL_DECK_CUSTOM_ID, 'deck_reuniao'],
    userDecks: [deckA, deckB],
  });
  assert.deepEqual(
    connectedWithVirtual.map((c) => c.id),
    ['custom_1', 'c3', 'c4']
  );

  // Also test filterStudyCards with studyScope === 'decks'
  const connectedFiltered = filterStudyCards({
    cards: allCards,
    selectedStudyIds: new Set(),
    connectedCardIds: new Set(connected.map((c) => c.id)),
    studyScope: 'decks',
    selectedCategory: 'all',
    selectedSubtopic: 'all',
    selectedStatus: 'all',
  });
  assert.equal(connectedFiltered.length, 4);

  // Virtual official deck excludes custom cards
  const officialOnly = resolveConnectedDecksCards({
    allCards,
    connectedDeckIds: [VIRTUAL_DECK_OFFICIAL_ID],
    userDecks: [],
  });
  assert.equal(officialOnly.length, 5);
  assert.ok(!officialOnly.some((c) => c.id === 'custom_1'));
});

test('defensive Firestore payload sanitizers enforce blueprint boundaries', () => {
  assert.equal(isValidFirestoreId('deck_123-abc'), true);
  assert.equal(isValidFirestoreId('__official__'), true);
  assert.equal(isValidFirestoreId('bad/slash'), false);

  const sanitizedCard = sanitizeCardFieldsForFirestore({
    term: 'x'.repeat(300),
    colloquial: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    exampleEn: 'Too short',
    examplePt: '',
    tip: 't'.repeat(500),
  });
  assert.equal(sanitizedCard.term.length, 140);
  assert.equal(sanitizedCard.colloquial.length, 8);
  assert.ok(sanitizedCard.exampleEn.length >= 12 && sanitizedCard.exampleEn.length <= 260);
  assert.ok(sanitizedCard.examplePt.length >= 2);
  assert.equal(sanitizedCard.tip.length, 400);

  const sanitizedDeck = sanitizeDeckFieldsForFirestore({
    name: '',
    cardIds: ['c1', 'c1', 'invalid/id', 'c2'],
  });
  assert.equal(sanitizedDeck.name, 'Meu Baralho');
  assert.deepEqual(sanitizedDeck.cardIds, ['c1', 'c2']);

  const sanitizedWs = sanitizeWorkspaceFieldsForFirestore({
    studyScope: 'decks',
    selectedCardIds: Array.from({ length: 30 }, (_, i) => `c${i}`),
    connectedDeckIds: ['deck_1', 'deck_1', 'bad id'],
    activeRound: 0,
  });
  assert.equal(sanitizedWs.selectedCardIds.length, 20);
  assert.deepEqual(sanitizedWs.connectedDeckIds, ['deck_1']);
  assert.equal(sanitizedWs.activeRound, 1);
});

test('generateQuizQuestion produces 4 unique options with exactly 1 correct answer', () => {
  const hydrated = INITIAL_CARDS.map(hydrateCard);
  const q = generateQuizQuestion(hydrated, 'Phrasal Verbs', 'all');
  assert.ok(q !== null);
  assert.equal(q.options.length, 4);
  assert.equal(q.options.filter((o) => o.isCorrect).length, 1);
  const texts = new Set(q.options.map((o) => o.text.toLowerCase()));
  assert.equal(texts.size, 4);
});

test('buildColloquialVariations removes robotic boilerplate and adds teacher synonyms', () => {
  const variations = buildColloquialVariations('Entender / Compreender', 'Figure out', [
    'Mandar o Figure out na conversa',
    'Sacar',
  ]);
  assert.ok(variations.includes('Entender'));
  assert.ok(variations.includes('Compreender'));
  assert.ok(variations.includes('Sacar'));
  assert.ok(!variations.some((v) => v.includes('Mandar o')));
});

test('extractPhoneticNotation separates meaning and EWM-US phonetic tag cleanly', () => {
  const parsed = extractPhoneticNotation('Resumir / Sintetizar (Pronúncia: /sâm ÂP/)');
  assert.equal(parsed.meaning, 'Resumir / Sintetizar');
  assert.equal(parsed.phonetic, '/sâm ÂP/');

  const nested = extractPhoneticNotation(
    'Resumir / Sintetizar (Pronúncia: /sâm ÂP/ (conectado: /sâ-MÂP/))'
  );
  assert.equal(nested.meaning, 'Resumir / Sintetizar');
  assert.equal(nested.phonetic, '/sâm ÂP/ (conectado: /sâ-MÂP/)');
});

test('exportCardsToCsv produces valid CSV header and rows', () => {
  const sample = INITIAL_CARDS.slice(0, 2).map(hydrateCard);
  const csv = exportCardsToCsv(sample);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes('Expressão,Tópico,Subtópico'));
  assert.ok(lines[1].includes('"Sum up"'));
});
