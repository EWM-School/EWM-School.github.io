import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditEnglishGrammarAndCollocations,
  isGenericTemplateSentence,
  isGoodRealExampleSentence,
  normalizePhrasalLookupKey,
  scoreTeacherSentenceCandidate,
} from './grammarEngine';

test('auditEnglishGrammarAndCollocations approves natural English sentences', () => {
  const valid1 = auditEnglishGrammarAndCollocations("This jacket fits perfectly—I'll take it!");
  assert.equal(valid1.valid, true);
  assert.equal(valid1.ruleCode, 'OK');

  const valid2 = auditEnglishGrammarAndCollocations(
    'Let me sum it up for you so we do not waste time.'
  );
  assert.equal(valid2.valid, true);
});

test('auditEnglishGrammarAndCollocations catches plural noun + singular pronoun agreement errors', () => {
  const res = auditEnglishGrammarAndCollocations("The shoes fit perfectly—I'll take it!");
  assert.equal(res.valid, false);
  assert.equal(res.ruleCode, 'PLURAL_NOUN_IT_AGREEMENT');
});

test('auditEnglishGrammarAndCollocations catches uncountable pluralization and indefinite articles', () => {
  const pluralized = auditEnglishGrammarAndCollocations('I received useful informations yesterday.');
  assert.equal(pluralized.valid, false);
  assert.equal(pluralized.ruleCode, 'UNCOUNTABLE_PLURALIZED');

  const article = auditEnglishGrammarAndCollocations('Can you give me a good advice about travel?');
  assert.equal(article.valid, false);
  assert.equal(article.ruleCode, 'UNCOUNTABLE_INDEFINITE_ARTICLE');
});

test('auditEnglishGrammarAndCollocations catches Portuguese-influenced preposition & verb errors', () => {
  assert.equal(
    auditEnglishGrammarAndCollocations('It depends of the weather tomorrow.').ruleCode,
    'DEPEND_OF'
  );
  assert.equal(
    auditEnglishGrammarAndCollocations('She has been married with him for years.').ruleCode,
    'MARRIED_WITH'
  );
  assert.equal(
    auditEnglishGrammarAndCollocations('Can you explain me how this works?').ruleCode,
    'EXPLAIN_WITHOUT_TO'
  );
  assert.equal(
    auditEnglishGrammarAndCollocations('We need to discuss about the budget today.').ruleCode,
    'DISCUSS_ABOUT'
  );
  assert.equal(
    auditEnglishGrammarAndCollocations('I am agree with everything you just said.').ruleCode,
    'BE_AGREE'
  );
  assert.equal(
    auditEnglishGrammarAndCollocations('I am looking forward to meet your team soon.').ruleCode,
    'LOOK_FORWARD_TO_BASE_VERB'
  );
});

test('isGenericTemplateSentence blocks synthetic boilerplate templates', () => {
  assert.equal(
    isGenericTemplateSentence('In everyday conversation, people often say sum up at work.'),
    true
  );
  assert.equal(
    isGenericTemplateSentence('We really need to call off before the end of the week.'),
    true
  );
  assert.equal(
    isGenericTemplateSentence('They had to call off the soccer match because of the rain.'),
    false
  );
});

test('isGoodRealExampleSentence matches irregular verbs and separable phrasal verbs', () => {
  assert.equal(
    isGoodRealExampleSentence('She was brought up by her grandparents in a small town.', 'bring up'),
    true
  );
  assert.equal(
    isGoodRealExampleSentence('Let me sum it up for you before the meeting ends.', 'sum up'),
    true
  );
  assert.equal(
    isGoodRealExampleSentence('We went out for dinner last Friday night.', 'bring up'),
    false
  );
});

test('scoreTeacherSentenceCandidate ranks concise practical sentences higher', () => {
  const high = scoreTeacherSentenceCandidate(
    "I'll bring up your idea at tomorrow's team meeting.",
    'bring up',
    'ai_teacher'
  );
  const bad = scoreTeacherSentenceCandidate('The shoes fit well—take it!', 'shoes', 'tatoeba');
  assert.ok(high > 60);
  assert.equal(bad, -100);
});

test('normalizePhrasalLookupKey strips infinitive "to" and placeholder pronouns', () => {
  assert.equal(normalizePhrasalLookupKey('To sum up'), 'sum up');
  assert.equal(normalizePhrasalLookupKey('call someone back'), 'call back');
});
