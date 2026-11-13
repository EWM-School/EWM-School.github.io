import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_CARDS } from '../data/seedData';
import type { Flashcard } from '../types/flashcard';
import { hydrateCard } from './deckHelpers';
import {
  areMeaningsColliding,
  buildExpressionBuilderRound,
  buildLightningMatchDeck,
  buildNativeEarQuestions,
  buildSurvivalChallenge,
  maskExpressionInSentence,
  normalizeCardForMiniGame,
  resolveMiniGameCardPool,
  tokenizeAndChunkForBuilder,
  validateExpressionBuilderAttempt,
} from './gameContentNormalizer';
import {
  ARENA_FREE_TRAINING_BADGE_PT,
  MAX_DAILY_GAMES_ARENA_XP,
  computeMiniGameMatchXp,
  getDailyGamesXpSnapshot,
  recordMiniGameSessionInStats,
} from './gameXpPolicy';
import { computeRealStudentMetrics, getDefaultStudyStats } from './studyMetrics';

function makeTestCard(overrides: Partial<Flashcard> & { id: string; term: string }): Flashcard {
  return hydrateCard({
    category: 'Phrasal Verbs',
    subtopic: 'Trabalho',
    literal: 'Tradução literal',
    colloquial: ['Desligar o telefone'],
    exampleEn: 'Please do not hang up while I check your reservation.',
    examplePt: 'Por favor, não desligue enquanto verifico sua reserva.',
    tip: 'Dica pedagógica EWM.',
    status: 'review',
    ...overrides,
  });
}

const starterReviewIds = new Set(['c1', 'c3', 'c7']);
const realCatalog: Flashcard[] = INITIAL_CARDS.map((c) =>
  hydrateCard({
    ...c,
    status: starterReviewIds.has(c.id) ? 'review' : 'mastered',
  })
);

test('miniGamesEngine: sanitizes slash "/" alternatives and parenthetical notes without broken blocks', () => {
  const card = makeTestCard({
    id: 'slash_paren_1',
    term: 'hang up / end the call (informal)',
    colloquial: ['desligar na cara / encerrar a ligação (coloquial)'],
  });

  const normalized = normalizeCardForMiniGame(card);
  assert.ok(normalized);
  assert.equal(normalized.primaryTerm, 'hang up');
  assert.equal(normalized.altTerms.includes('end the call'), true);
  assert.equal(normalized.primaryTerm.includes('/'), false);
  assert.equal(normalized.primaryTerm.includes('('), false);
  assert.equal(Boolean(normalized.contextualNote && normalized.contextualNote.includes('informal')), true);
  assert.equal(normalized.primaryPt, 'desligar na cara');

  const round = buildExpressionBuilderRound(normalized, { preferSentence: false });
  for (const block of round.expectedBlocks) {
    assert.equal(block.text.includes('/'), false);
    assert.equal(block.text.includes('(informal)'), false);
  }
});

test('miniGamesEngine: preserves legitimate numeric ratios like 24/7 while stripping parentheticals', () => {
  const card = makeTestCard({
    id: 'ratio_247',
    term: 'open 24/7 (very common)',
    colloquial: ['aberto 24 horas por dia'],
    exampleEn: 'The pharmacy near the hotel is open 24/7.',
    examplePt: 'A farmácia perto do hotel fica aberta 24 horas.',
  });

  const normalized = normalizeCardForMiniGame(card);
  assert.ok(normalized);
  assert.equal(normalized.primaryTerm, 'open 24/7');
  assert.equal(normalized.contextualNote, 'very common');
});

test('miniGamesEngine: sanitizes 100% of real EWM INITIAL_CARDS with zero broken "/" or "(...)" blocks', () => {
  const pool = resolveMiniGameCardPool(realCatalog, { mode: 'all' });
  assert.equal(pool.cards.length >= 20, true);

  for (const normCard of pool.cards) {
    if (!/\b24\/7\b/.test(normCard.primaryTerm)) {
      assert.equal(normCard.primaryTerm.includes('/'), false);
    }
    assert.equal(/\([^)]*\)/.test(normCard.primaryTerm), false);

    const round = buildExpressionBuilderRound(normCard);
    assert.equal(round.expectedBlocks.length >= 2, true);
    assert.equal(round.expectedBlocks.length <= 9, true);
    for (const b of round.expectedBlocks) {
      if (!/\b24\/7\b/.test(b.text)) {
        assert.equal(b.text.includes('/'), false);
      }
      assert.equal(/\([^)]*\)/.test(b.text), false);
    }
  }
});

test('miniGamesEngine: gracefully tops up pool from Acervo EWM when scope filter has < 5 cards', () => {
  // Only 3 cards in `realCatalog` are marked `review`
  const resolved = resolveMiniGameCardPool(realCatalog, { mode: 'review_priority' });
  assert.equal(resolved.originalMatchCount, 3);
  assert.equal(resolved.usedFallback, true);
  assert.equal(resolved.cards.length >= 5, true);
  assert.equal(Boolean(resolved.fallbackNoticePt), true);

  const allResolved = resolveMiniGameCardPool(realCatalog, { mode: 'all' });
  assert.equal(allResolved.usedFallback, false);
  assert.equal(allResolved.fallbackNoticePt, null);
});

test('miniGamesEngine: chunks > 10-word sentences into 5..9 natural syntagms and separates terminal punctuation', () => {
  const longSentence =
    'When we get to the airport tomorrow morning we are going to check in right away!';
  const tokenized = tokenizeAndChunkForBuilder(longSentence);

  assert.equal(tokenized.terminalPunctuation, '!');
  assert.equal(tokenized.blocks.length >= 5, true);
  assert.equal(tokenized.blocks.length <= 9, true);
  for (const blockText of tokenized.blocks) {
    assert.equal(blockText.endsWith('!'), false);
    assert.equal(blockText.endsWith('.'), false);
  }
  assert.equal(
    tokenized.blocks.join(' '),
    'When we get to the airport tomorrow morning we are going to check in right away'
  );
});

test('miniGamesEngine: treats duplicate identical blocks ("the", "to") as 100% interchangeable (zero false negatives)', () => {
  const card = makeTestCard({
    id: 'dup_blocks_card',
    term: 'go from the hotel to the station',
    colloquial: ['ir do hotel até a estação'],
    exampleEn: 'We took a cab to go from the hotel to the station.',
    examplePt: 'Pegamos um táxi para ir do hotel até a estação.',
  });
  const norm = normalizeCardForMiniGame(card);
  assert.ok(norm);
  const round = buildExpressionBuilderRound(norm, { preferSentence: false });

  const theIndices = round.expectedBlocks
    .map((b, idx) => (b.normalizedText === 'the' ? idx : -1))
    .filter((idx) => idx >= 0);
  assert.equal(theIndices.length, 2);

  const swappedAttempt = [...round.expectedBlocks];
  const [firstTheIdx, secondTheIdx] = theIndices;
  const temp = swappedAttempt[firstTheIdx];
  swappedAttempt[firstTheIdx] = swappedAttempt[secondTheIdx];
  swappedAttempt[secondTheIdx] = temp;

  assert.notEqual(swappedAttempt[firstTheIdx].id, round.expectedBlocks[firstTheIdx].id);
  const check = validateExpressionBuilderAttempt(swappedAttempt, round.expectedBlocks);
  assert.equal(check.isComplete, true);
  assert.equal(check.isCorrect, true);
});

test('miniGamesEngine: guarantees collision-free distractors in Native Ear, Lightning Match & Survival', () => {
  const cardA = normalizeCardForMiniGame(
    makeTestCard({
      id: 'syn_a',
      term: 'give up',
      colloquial: ['desistir', 'abrir mão'],
    })
  );
  const cardB = normalizeCardForMiniGame(
    makeTestCard({
      id: 'syn_b',
      term: 'throw in the towel',
      colloquial: ['desistir de vez', 'jogar a toalha'],
    })
  );
  const cardC = normalizeCardForMiniGame(
    makeTestCard({
      id: 'syn_c',
      term: 'check in',
      colloquial: ['fazer o registro no hotel'],
    })
  );

  assert.ok(cardA && cardB && cardC);
  assert.equal(areMeaningsColliding(cardA, cardB), true);
  assert.equal(areMeaningsColliding(cardA, cardC), false);

  const pool = resolveMiniGameCardPool(realCatalog, { mode: 'all' }).cards;
  const questions = buildNativeEarQuestions(pool, pool, 'mixed', 8, () => 0.42);
  assert.equal(questions.length, 8);
  for (const q of questions) {
    assert.equal(q.options.length, 4);
    assert.equal(q.options.filter((o) => o.isCorrect).length, 1);
    const uniqueLabels = new Set(q.options.map((o) => o.labelPt.toLowerCase()));
    assert.equal(uniqueLabels.size, 4);
  }

  const deck = buildLightningMatchDeck(pool, pool, 16, () => 0.37);
  assert.equal(deck.length >= 15 && deck.length <= 20, true);
  assert.equal(new Set(deck.map((d) => d.englishText.toLowerCase())).size, deck.length);
  assert.equal(new Set(deck.map((d) => d.portugueseText.toLowerCase())).size, deck.length);

  const maskedInflected = maskExpressionInSentence(
    'She hung up before I could explain.',
    'hang up'
  );
  assert.ok(maskedInflected && maskedInflected.includes('______'));
  assert.equal(maskedInflected.toLowerCase().includes('hung up'), false);

  const maskedSeparable = maskExpressionInSentence(
    'He never lets his team down.',
    'let down'
  );
  assert.ok(maskedSeparable && maskedSeparable.includes('his team'));
  assert.equal(maskedSeparable.toLowerCase().includes('lets'), false);

  const survivalChallenge = buildSurvivalChallenge(pool[0], pool, 0, () => 0.25);
  assert.equal(survivalChallenge.options.length, 4);
  assert.equal(survivalChallenge.options.filter((o) => o.isCorrect).length, 1);
});

test('gameXpPolicy: enforces balanced match XP (+8..+15 +3 flawless) and strict 120 XP/day Anti-Farming cap', () => {
  const perfect = computeMiniGameMatchXp({
    gameId: 'native-ear',
    correctCount: 8,
    totalItems: 8,
    mistakesCount: 0,
  });
  assert.equal(perfect.baseXp, 15);
  assert.equal(perfect.perfectBonusXp, 3);
  assert.equal(perfect.rawTotalXp, 18);

  const moderate = computeMiniGameMatchXp({
    gameId: 'expression-builder',
    correctCount: 3,
    totalItems: 6,
    mistakesCount: 3,
  });
  assert.equal(moderate.baseXp >= 8 && moderate.baseXp <= 15, true);
  assert.equal(moderate.perfectBonusXp, 0);

  const spamFail = computeMiniGameMatchXp({
    gameId: 'native-ear',
    correctCount: 1,
    totalItems: 8,
    mistakesCount: 7,
  });
  assert.equal(spamFail.rawTotalXp, 0);

  const dayOne = new Date(2026, 10, 13, 14, 0, 0);
  const dayTwo = new Date(2026, 10, 14, 9, 30, 0);

  let stats = getDefaultStudyStats(dayOne);
  let cumulativeDayOneXp = 0;

  // 10 consecutive perfect matches (10 * 18 = 180 raw XP) on the same calendar day
  for (let i = 0; i < 10; i++) {
    const outcome = recordMiniGameSessionInStats(
      {
        gameId: 'lightning-match',
        correctCount: 16,
        totalItems: 16,
        mistakesCount: 0,
      },
      stats,
      dayOne
    );
    cumulativeDayOneXp += outcome.awardedXp;
    stats = outcome.updatedStats;
  }

  assert.equal(cumulativeDayOneXp, MAX_DAILY_GAMES_ARENA_XP);
  assert.equal(stats.todayGamesEarnedXp, 120);
  assert.equal(stats.monthlyGamesXp, 120);

  const snapDayOne = getDailyGamesXpSnapshot(stats, dayOne);
  assert.equal(snapDayOne.capReached, true);
  assert.equal(snapDayOne.remainingXp, 0);
  assert.equal(ARENA_FREE_TRAINING_BADGE_PT.includes('modo treino livre ativo'), true);

  // Free training mode after hitting 120 XP/day: awards 0 XP yet persists new Survival Personal Best!
  const freeTrainingSurvival = recordMiniGameSessionInStats(
    {
      gameId: 'survival',
      correctCount: 14,
      totalItems: 17,
      mistakesCount: 3,
      bestStreakInRun: 11,
    },
    stats,
    dayOne
  );
  assert.equal(freeTrainingSurvival.awardedXp, 0);
  assert.equal(freeTrainingSurvival.dailyCapReached, true);
  assert.equal(freeTrainingSurvival.beatPreviousRecord, true);
  assert.equal(freeTrainingSurvival.newSurvivalBestStreak, 11);
  stats = freeTrainingSurvival.updatedStats;

  // Next day (YYYY-MM-DD + 1): daily cap resets cleanly and feeds legitimate Monthly Ranking XP
  const nextDayMatch = recordMiniGameSessionInStats(
    {
      gameId: 'native-ear',
      correctCount: 8,
      totalItems: 8,
      mistakesCount: 0,
    },
    stats,
    dayTwo
  );
  assert.equal(nextDayMatch.awardedXp, 18);
  assert.equal(nextDayMatch.todayTotalGamesXp, 18);
  assert.equal(nextDayMatch.updatedStats.monthlyGamesXp, 138);
  assert.equal(nextDayMatch.updatedStats.survivalBestStreak, 11);

  const rankingMetrics = computeRealStudentMetrics({
    stats: nextDayMatch.updatedStats,
    masteredCount: 0,
    reviewCount: 0,
    quizScore: 0,
  });
  // 2 active days (2 * 50 = 100) + 138 Arena XP = 238 legitimate Ranking XP
  assert.equal(rankingMetrics.score, 238);
});
