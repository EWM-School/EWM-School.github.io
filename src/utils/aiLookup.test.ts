import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateNewExampleSentence,
  lookupSmartCardContent,
  naturalizePortugueseSentence,
} from './aiLookup';
import { auditEnglishGrammarAndCollocations, isGenericTemplateSentence } from './grammarEngine';
import { INITIAL_CARDS } from '../data/seedData';

test('naturalizePortugueseSentence strips grounding artifacts, arrows, and quotes while ensuring clean punctuation', () => {
  const result = naturalizePortugueseSentence('→ "A gente já vai começar a reunião [1]"');
  assert.equal(result, 'A gente já vai começar a reunião.');
  assert.equal(naturalizePortugueseSentence('Tudo certo por aqui!'), 'Tudo certo por aqui!');
});

test('generateNewExampleSentence generates an audited sentence distinct from current examples', async () => {
  const term = 'Figure out';
  const current = ['I need to figure out how this works.'];
  const res = await generateNewExampleSentence(term, current, 1, 'Phrasal Verbs', 'Entender / Resolver');

  assert.ok(res.exampleEn, 'exampleEn must not be empty');
  assert.ok(res.examplePt, 'examplePt must not be empty');
  assert.notEqual(res.exampleEn.toLowerCase(), current[0].toLowerCase(), 'Must not duplicate current example');

  const audit = auditEnglishGrammarAndCollocations(res.exampleEn, term);
  assert.equal(audit.valid, true, `Generated sentence must be grammatically valid: ${audit.reason}`);
  assert.equal(isGenericTemplateSentence(res.exampleEn), false, 'Must not be a generic boilerplate template');
});

test('lookupSmartCardContent fills 100% of fields with verified data in EN -> PT direction and blocks synthetic offline templates', async () => {
  const result = await lookupSmartCardContent('Long story short', 'en-to-pt', INITIAL_CARDS);
  assert.ok(result, 'Result must exist');
  assert.ok(result.term, 'term must be populated');
  assert.ok(result.category, 'category must be populated');
  assert.ok(result.subtopic, 'subtopic must be populated');
  assert.ok(result.literal, 'literal must be populated');
  assert.ok(result.colloquial.length > 0, 'colloquial array must not be empty');
  assert.ok(result.phoneticUs, 'phoneticUs must be populated');
  assert.ok(result.phoneticUk, 'phoneticUk must be populated');
  assert.ok(result.exampleEn, 'exampleEn must be 100% populated');
  assert.ok(result.examplePt, 'examplePt must be 100% populated');
  assert.ok(result.exampleEn2, 'exampleEn2 must be 100% populated');
  assert.ok(result.examplePt2, 'examplePt2 must be 100% populated');
  assert.ok(result.tip, 'tip must be populated');

  // Verify grammar and quality of example 1 and example 2
  const audit1 = auditEnglishGrammarAndCollocations(result.exampleEn, result.term);
  assert.equal(audit1.valid, true, `Example 1 must be grammatically valid: ${audit1.reason}`);
  const audit2 = auditEnglishGrammarAndCollocations(result.exampleEn2, result.term);
  assert.equal(audit2.valid, true, `Example 2 must be grammatically valid: ${audit2.reason}`);

  // Unseen expression offline must throw honest LinguisticOfflineError rather than inventing synthetic templates
  await assert.rejects(
    () => lookupSmartCardContent('Hit the ground running', 'en-to-pt', INITIAL_CARDS),
    { name: 'LinguisticOfflineError' }
  );
});

test('lookupSmartCardContent fills 100% of fields when queried in PT -> EN direction', async () => {
  const result = await lookupSmartCardContent('pisar na bola', 'pt-to-en', INITIAL_CARDS);
  assert.ok(result, 'Result must exist');
  assert.ok(result.term, 'term must be populated');
  assert.ok(result.exampleEn, 'exampleEn must be populated');
  assert.ok(result.examplePt, 'examplePt must be populated');
  assert.ok(result.phoneticUs, 'phoneticUs must be populated');
  assert.ok(result.phoneticUk, 'phoneticUk must be populated');
});
