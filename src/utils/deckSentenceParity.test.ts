import assert from 'node:assert/strict';
import test from 'node:test';
import rawSeed from '../data/rawSeed.json';
import { INITIAL_CARDS } from '../data/seedData';
import type { Flashcard } from '../types/flashcard';
import { hydrateCard } from './deckHelpers';
import {
  buildExpressionBuilderRound,
  cleanSentenceForGame,
  hasDanglingEndingOrEllipsis,
  normalizeCardForMiniGame,
} from './gameContentNormalizer';

const SECOND_EXAMPLES_MAP = (rawSeed.SECOND_EXAMPLES_MAP || {}) as Record<
  string,
  { en2?: string; pt2?: string }
>;

test('deckSentenceParity: 100% of INITIAL_CARDS and SECOND_EXAMPLES_MAP have complete EN/PT sentences with zero ellipses or mid-sentence slash splits', () => {
  assert.ok(INITIAL_CARDS.length >= 170);

  for (const rawCard of INITIAL_CARDS) {
    const en1 = (rawCard.exampleEn || '').trim();
    const pt1 = (rawCard.examplePt || '').trim();

    assert.ok(en1.length >= 8, `Card ${rawCard.id} missing exampleEn`);
    assert.ok(pt1.length >= 8, `Card ${rawCard.id} missing examplePt`);

    // Zero ellipses in examples
    assert.equal(
      /\.\.\.|…/.test(en1),
      false,
      `Card ${rawCard.id} exampleEn contains ellipsis: "${en1}"`
    );
    assert.equal(
      /\.\.\.|…/.test(pt1),
      false,
      `Card ${rawCard.id} examplePt contains ellipsis: "${pt1}"`
    );

    // Zero dangling endings in exampleEn
    assert.equal(
      hasDanglingEndingOrEllipsis(en1),
      false,
      `Card ${rawCard.id} exampleEn has dangling ending: "${en1}"`
    );

    // Zero inline slash alternatives in PT examples (excluding 24/7)
    if (!/\b24\/7\b/.test(pt1)) {
      assert.equal(
        pt1.includes('/'),
        false,
        `Card ${rawCard.id} examplePt still has inline slash alternative: "${pt1}"`
      );
    }

    // Check numeric parity: any clock digits like 6:30 or standalone numbers in EN must have numeric/written parity in PT
    if (/\b6:30\b/.test(en1)) {
      assert.equal(
        /6h30|6:30/.test(pt1),
        true,
        `Card ${rawCard.id} missing 6:30 time parity in PT: "${pt1}"`
      );
    }

    const second = SECOND_EXAMPLES_MAP[rawCard.id];
    if (second?.en2 || second?.pt2) {
      const en2 = (second.en2 || '').trim();
      const pt2 = (second.pt2 || '').trim();
      assert.ok(en2.length >= 8, `Card ${rawCard.id} missing en2`);
      assert.ok(pt2.length >= 8, `Card ${rawCard.id} missing pt2`);
      assert.equal(/\.\.\.|…/.test(en2), false, `Card ${rawCard.id} en2 has ellipsis`);
      assert.equal(/\.\.\.|…/.test(pt2), false, `Card ${rawCard.id} pt2 has ellipsis`);
      assert.equal(
        hasDanglingEndingOrEllipsis(en2),
        false,
        `Card ${rawCard.id} en2 has dangling ending: "${en2}"`
      );
      if (!/\b24\/7\b/.test(pt2)) {
        assert.equal(
          pt2.includes('/'),
          false,
          `Card ${rawCard.id} pt2 has slash alternative: "${pt2}"`
        );
      }
    }
  }
});

test('deckSentenceParity: verifies landmark bug-report cards (pv_1 6:30 weekdays, c7 total no-brainer, mari_53 I work as a...)', () => {
  const catalog = new Map(
    INITIAL_CARDS.map((c) => [c.id, hydrateCard({ ...c, status: 'review' })])
  );

  // 1) pv_1: "I usually get up at 6:30 AM on weekdays."
  const pv1 = catalog.get('pv_1');
  assert.ok(pv1);
  const normPv1 = normalizeCardForMiniGame(pv1);
  assert.ok(normPv1);
  const roundPv1 = buildExpressionBuilderRound(normPv1, { preferSentence: true });
  assert.equal(roundPv1.targetEnglish, 'I usually get up at 6:30 AM on weekdays.');
  assert.match(roundPv1.promptPt, /6h30|6:30/);
  assert.match(roundPv1.promptPt.toLowerCase(), /dias de semana/);

  // 2) c7: "Accepting that job offer was a total no-brainer."
  const c7 = catalog.get('c7');
  assert.ok(c7);
  const normC7 = normalizeCardForMiniGame(c7);
  assert.ok(normC7);
  const roundC7 = buildExpressionBuilderRound(normC7, { preferSentence: true });
  assert.match(roundC7.targetEnglish, /total no-brainer/i);
  assert.match(roundC7.promptPt.toLowerCase(), /totalmente/);

  // 3) mari_53: Open template "I work as a..." must NEVER produce "I work as a."
  const mari53 = catalog.get('mari_53');
  assert.ok(mari53);
  const normMari53 = normalizeCardForMiniGame(mari53);
  assert.ok(normMari53);
  const roundMari53Sentence = buildExpressionBuilderRound(normMari53, {
    preferSentence: true,
  });
  const roundMari53Term = buildExpressionBuilderRound(normMari53, {
    preferSentence: false,
  });
  assert.equal(hasDanglingEndingOrEllipsis(roundMari53Sentence.targetEnglish), false);
  assert.equal(hasDanglingEndingOrEllipsis(roundMari53Term.targetEnglish), false);
  assert.notEqual(roundMari53Term.targetEnglish.toLowerCase(), 'i work as a.');
  assert.notEqual(roundMari53Term.targetEnglish.toLowerCase(), 'i work as a');
});

test('deckSentenceParity: safety lock repairs synthetic truncated/dangling template cards ("I work as a.") and preserves valid punctuation', () => {
  const brokenTemplateCard: Flashcard = hydrateCard({
    id: 'synthetic_dangling_1',
    term: 'I work as a...',
    category: 'Frases',
    subtopic: 'Trabalho',
    literal: 'Eu trabalho como um...',
    colloquial: ['Eu trabalho como...'],
    exampleEn: 'I work as a.',
    examplePt: 'Eu trabalho como...',
    tip: 'Molde aberto de profissão.',
    status: 'review',
  });

  const normalized = normalizeCardForMiniGame(brokenTemplateCard);
  assert.ok(normalized);

  const roundSentence = buildExpressionBuilderRound(normalized, { preferSentence: true });
  const roundTerm = buildExpressionBuilderRound(normalized, { preferSentence: false });

  assert.equal(hasDanglingEndingOrEllipsis(roundSentence.targetEnglish), false);
  assert.equal(hasDanglingEndingOrEllipsis(roundTerm.targetEnglish), false);
  assert.equal(/\.\.\.|…/.test(roundSentence.promptPt), false);
  assert.equal(/\.\.\.|…/.test(roundTerm.promptPt), false);
  assert.match(roundTerm.targetEnglish, /project manager/i);
  assert.match(roundTerm.promptPt.toLowerCase(), /gerente de projetos/);

  // Verify cleanSentenceForGame preserves colons, hyphens, ratios, morphological gender, and slashes in full sentences
  assert.equal(
    cleanSentenceForGame('Eu costumo acordar / levantar às 6:30 (todos os dias).'),
    'Eu costumo acordar / levantar às 6:30 (todos os dias).'
  );
  assert.equal(
    cleanSentenceForGame('Muito obrigado(a) pela ajuda 24/7!'),
    'Muito obrigado(a) pela ajuda 24/7!'
  );
});

test('deckSentenceParity: 100% of catalog cards produce complete, non-dangling Expression Builder rounds in both sentence and term modes', () => {
  for (const raw of INITIAL_CARDS) {
    const hydrated = hydrateCard({ ...raw, status: 'review' });
    const norm = normalizeCardForMiniGame(hydrated);
    assert.ok(norm, `Card ${raw.id} failed normalization`);

    for (const preferSentence of [true, false]) {
      const round = buildExpressionBuilderRound(norm, { preferSentence });
      assert.equal(
        hasDanglingEndingOrEllipsis(round.targetEnglish),
        false,
        `Card ${raw.id} (preferSentence=${preferSentence}) produced dangling EN: "${round.targetEnglish}"`
      );
      assert.equal(
        /\.\.\.|…/.test(round.promptPt),
        false,
        `Card ${raw.id} (preferSentence=${preferSentence}) produced ellipsis in PT: "${round.promptPt}"`
      );
      assert.ok(
        round.expectedBlocks.length >= 2,
        `Card ${raw.id} produced fewer than 2 blocks`
      );
    }
  }
});
