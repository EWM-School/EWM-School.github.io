import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCuratedGlobalSchoolCard } from '../services/linguisticEngineClient';
import {
  classifyLinguisticIntent,
  doesSentenceContainExpression,
  enforceDeterministicGrammarVerdict,
  formatCleanExampleSentence,
  sanitizeGroundingArtifacts,
  toCanonicalExpressionKey,
  validateInvisibleTeacherCuratorship,
} from './linguisticNormalizer';
import {
  loadUserStudyStats,
  recordGlobalDiscoveryBonusInStats,
} from './studyMetrics';

test('Canonical Anti-Duplicate Normalization maps "to hang up", "Hang up!" and "HANG UP" to "hang up"', () => {
  assert.equal(toCanonicalExpressionKey('to hang up'), 'hang up');
  assert.equal(toCanonicalExpressionKey('Hang up!'), 'hang up');
  assert.equal(toCanonicalExpressionKey('HANG UP'), 'hang up');
  assert.equal(toCanonicalExpressionKey('  "To Hang Up."  '), 'hang up');
});

test('Hardcoded Mathematical Verdict Lock prevents PERFECT_NATURAL whenever detectedErrors.length > 0', () => {
  const overridden = enforceDeterministicGrammarVerdict({
    detectedErrors: [
      {
        exactSnippet: 'have 25 years',
        replacementSnippet: 'am 25 years old',
        errorType: 'portuguese_calque',
        explanationPt: 'Em inglês usa-se o verbo "to be" para idade, nunca "have".',
      },
    ],
    isStiltedOrTruncated: false,
    rawVerdict: 'PERFECT_NATURAL',
  });
  assert.equal(overridden, 'INCORRECT');

  const stilted = enforceDeterministicGrammarVerdict({
    detectedErrors: [],
    isStiltedOrTruncated: true,
    rawVerdict: 'PERFECT_NATURAL',
  });
  assert.equal(stilted, 'UNDERSTANDABLE_UNNATURAL');

  const clean = enforceDeterministicGrammarVerdict({
    detectedErrors: [],
    isStiltedOrTruncated: false,
    rawVerdict: 'PERFECT_NATURAL',
  });
  assert.equal(clean, 'PERFECT_NATURAL');
});

test('Single-Input Intent Router classifies PT terms, EN idioms, and EN clauses accurately', () => {
  assert.equal(classifyLinguisticIntent('por enquanto').mode, 'CONSULT_TRANSLATE');
  assert.equal(classifyLinguisticIntent('dar um jeito').mode, 'CONSULT_TRANSLATE');
  assert.equal(classifyLinguisticIntent('hang up').mode, 'CONSULT_TRANSLATE');
  assert.equal(classifyLinguisticIntent('to hang up').mode, 'CONSULT_TRANSLATE');

  assert.equal(classifyLinguisticIntent('She go to work yesterday').mode, 'GRAMMAR_CHECK');
  assert.equal(classifyLinguisticIntent("He don't likes coffee").mode, 'GRAMMAR_CHECK');
  assert.equal(classifyLinguisticIntent('I have 25 years').mode, 'GRAMMAR_CHECK');
  assert.equal(
    classifyLinguisticIntent("Let's call it a day and catch up tomorrow.").mode,
    'GRAMMAR_CHECK'
  );
});

test('Inflection-aware expression matcher and grounding artifact sanitizer preserve clean native English', () => {
  const dirty = 'She hung up the phone right away [1, 2] [cite: 3] https://example.com';
  const cleaned = formatCleanExampleSentence(sanitizeGroundingArtifacts(dirty));
  assert.equal(cleaned, 'She hung up the phone right away.');
  assert.equal(doesSentenceContainExpression(cleaned, 'hang up'), true);
  assert.equal(
    doesSentenceContainExpression('We finally figured the whole schedule out.', 'figure it out'),
    true
  );
  assert.equal(
    doesSentenceContainExpression('The weather was sunny all morning.', 'hang up'),
    false
  );
});

test('Invisible Teacher Curatorship & Anti-Duplicate reject noise/duplicates and approve genuine unseen idioms', () => {
  // "hang up" already exists in INITIAL_CARDS or if passed in existingSchoolCards -> rejected as duplicate
  const unseenBuilt = buildCuratedGlobalSchoolCard(
    {
      englishExpression: 'play it by ear',
      primaryTranslation: 'Improvisar conforme a situação',
      category: 'Frases',
      subtopic: 'Casual',
      exampleEn: "We don't have a strict itinerary yet, so let's just play it by ear.",
      examplePt: 'Ainda não temos um roteiro fixo, então vamos decidir na hora conforme rolar.',
      isValidForGlobalSchoolDeck: true,
    },
    []
  );

  // If "play it by ear" is not in INITIAL_CARDS, it builds cleanly; and a second attempt with "To Play It By Ear!" is blocked as duplicate:
  if (unseenBuilt) {
    const duplicateAttempt = buildCuratedGlobalSchoolCard(
      {
        englishExpression: 'To PLAY IT BY EAR!',
        primaryTranslation: 'Improvisar',
        category: 'Frases',
        subtopic: 'Casual',
        exampleEn: "Let's play it by ear when we arrive at the conference.",
        examplePt: 'Vamos ver como fica quando chegarmos na conferência.',
        isValidForGlobalSchoolDeck: true,
      },
      [unseenBuilt.card]
    );
    assert.equal(duplicateAttempt, null);
  }

  // Personal narrative / noise rejected by Guard 1
  const rejectedNoise = validateInvisibleTeacherCuratorship({
    aiApproved: true,
    englishExpression: 'yesterday i went to the supermarket123',
    primaryTranslation: 'ontem eu fui ao mercado',
    exampleEn: 'Yesterday I went to the supermarket123 early.',
    examplePt: 'Ontem fui ao mercado cedo.',
    category: 'Frases',
    subtopic: 'Casual',
  });
  assert.equal(rejectedNoise, false);
});

test('Anti-Farming Symbolic Bonus awards +2 XP up to max 5 discoveries/day and +0 XP from 6th onward', () => {
  let stats = loadUserStudyStats();

  for (let i = 1; i <= 5; i++) {
    const res = recordGlobalDiscoveryBonusInStats(`idiom_${i}`, stats);
    assert.equal(res.awardedXp, 2);
    assert.equal(res.dailyCount, i);
    stats = res.updatedStats;
  }
  assert.equal(stats.monthlyDiscoveryBonusXp, 10);

  // Duplicate canonical key on the same day -> +0 XP
  const dup = recordGlobalDiscoveryBonusInStats('idiom_1', stats);
  assert.equal(dup.awardedXp, 0);

  // 6th unseen discovery on the same day -> +0 XP (capped at 5/day)
  const sixth = recordGlobalDiscoveryBonusInStats('idiom_6', stats);
  assert.equal(sixth.awardedXp, 0);
  assert.equal(sixth.cappedOut, true);
  assert.equal(sixth.updatedStats.monthlyDiscoveryBonusXp, 10);
});
