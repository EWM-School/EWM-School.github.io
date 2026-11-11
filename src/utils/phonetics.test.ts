import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_CARDS } from '../data/seedData';
import {
  CURATED_SEED_UK_BY_ID,
  getCardPhonetics,
  ipaToEwmPhonetic,
  synthesizeOfflinePhrasePhonetics,
} from './phonetics';
import {
  buildNativeCloudAudioUrls,
  cleanEnglishForSpeech,
  cleanSpeechSearchQuery,
} from './speech';

test('All 172 existing seed cards have curated, hand-audited US and UK native phonetics', () => {
  assert.equal(INITIAL_CARDS.length, 172);
  for (const card of INITIAL_CARDS) {
    assert.ok(
      CURATED_SEED_UK_BY_ID[card.id],
      `Missing curated UK entry for seed card ${card.id} (${card.term})`
    );
    const resolved = getCardPhonetics(card);
    assert.ok(resolved.us.startsWith('/'), `Invalid US phonetic on ${card.id}: ${resolved.us}`);
    assert.ok(resolved.uk.startsWith('/'), `Invalid UK phonetic on ${card.id}: ${resolved.uk}`);
    assert.ok(resolved.meaning.length > 0, `Empty literal meaning on ${card.id}`);
  }
});

test('Linguistic contrasts between American (EWM-US) and British (EWM-UK) phonetics are exact', () => {
  const byId = new Map(INITIAL_CARDS.map((c) => [c.id, c]));

  // 1. reschedule: /SKÉ/ (US) vs /XÉ/ (UK)
  const reschedule = getCardPhonetics(byId.get('mari_38')!);
  assert.match(reschedule.us, /ri-SKÉ-djul/);
  assert.match(reschedule.uk, /ri-XÉ-diul/);

  // 2. water: flap T + rhotic /UÓ-râr/ (US) vs crisp T + non-rhotic /UÓ-tâ/ (UK)
  const water = getCardPhonetics(byId.get('mari_84')!);
  assert.match(water.us, /UÓ-râr/);
  assert.match(water.uk, /UÓ-tâ/);

  // 3. beautiful: /BIÚ-ri-fôl/ (US) vs /BIÚ-ti-fôl/ (UK)
  const beautiful = getCardPhonetics(byId.get('mari_77')!);
  assert.match(beautiful.us, /BIÚ-ri-fôl/);
  assert.match(beautiful.uk, /BIÚ-ti-fôl/);

  // 4. pasta: /PÁS-ta/ (US) vs /PÉS-tâ/ (UK)
  const pasta = getCardPhonetics(byId.get('mari_83')!);
  assert.match(pasta.us, /PÁS-ta/);
  assert.match(pasta.uk, /PÉS-tâ/);

  // 5. afternoon: TRAP-BATH split /éf-ter-NÚN/ (US) vs /áaf-tâ-NÚN/ (UK)
  const afternoon = getCardPhonetics(byId.get('mari_2')!);
  assert.match(afternoon.us, /éf-ter-NÚN/);
  assert.match(afternoon.uk, /áaf-tâ-NÚN/);

  // 6. Take it with a grain of salt -> UK note mentions 'pinch of salt'
  const salt = getCardPhonetics(byId.get('c6')!);
  assert.ok(salt.ukNote?.includes('pinch of salt'));
  assert.equal(salt.ukVariantTerm, 'Take it with a pinch of salt');
});

test('IPA transducer and offline synthesizer generate distinct US and UK phonetics for new cards', () => {
  const usSchedule = ipaToEwmPhonetic('/ˈskɛdʒ.uːl/', 'us');
  const ukSchedule = ipaToEwmPhonetic('/ˈʃɛd.juːl/', 'uk');
  assert.match(usSchedule, /^\/SKÉ/);
  assert.match(ukSchedule, /^\/XÉ/);

  const offline = synthesizeOfflinePhrasePhonetics("I can't pass this water bottle");
  assert.match(offline.us, /ként/);
  assert.match(offline.uk, /káant/);
  assert.match(offline.us, /UÓ-râr/);
  assert.match(offline.uk, /UÓ-tâ/);
});

test('Speech engine preserves contractions and strictly separates en-US and en-GB native streams', () => {
  // Apostrophes inside contractions MUST be preserved so "I'll" is never spoken as "ill"!
  assert.equal(
    cleanEnglishForSpeech("“I’ll call you back, don't worry!” (informal)"),
    "I'll call you back, don't worry!"
  );
  assert.equal(cleanEnglishForSpeech('My name is…'), 'My name is');

  const usUrls = buildNativeCloudAudioUrls('Can we reschedule?', 'us');
  const ukUrls = buildNativeCloudAudioUrls('Can we reschedule?', 'uk');

  assert.ok(usUrls.every((u) => u.includes('tl=en-US') || u.includes('type=2')));
  assert.ok(ukUrls.every((u) => u.includes('tl=en-GB') || u.includes('type=1')));
  // Youdao URL must strip '?' so it never triggers HTTP 500
  const youdaoUk = ukUrls.find((u) => u.includes('dict.youdao.com'))!;
  assert.ok(!decodeURIComponent(youdaoUk).includes('?Can'));
  assert.ok(!youdaoUk.includes('%3F'));
});

test('Voice search query cleaner strips punctuation and extra quotes for robust card search', () => {
  assert.equal(cleanSpeechSearchQuery('“couch potato.”'), 'couch potato');
  assert.equal(cleanSpeechSearchQuery('hang out?'), 'hang out');
  assert.equal(cleanSpeechSearchQuery('  piece of cake!  '), 'piece of cake');
  assert.equal(cleanSpeechSearchQuery("let's call it a day..."), "let's call it a day");
  assert.equal(cleanSpeechSearchQuery(''), '');
});

test('Full-deck Audio Audit: 172 cards reading precision & male UK voice contrast', () => {
  let auditedTerms = 0;
  let auditedSentences = 0;

  for (const card of INITIAL_CARDS) {
    // 1. Term reading audit
    const cleanedTerm = cleanEnglishForSpeech(card.term);
    assert.ok(cleanedTerm.length > 0, `Cleaned term empty on card ${card.id}`);
    const usTermUrls = buildNativeCloudAudioUrls(cleanedTerm, 'us');
    const ukTermUrls = buildNativeCloudAudioUrls(cleanedTerm, 'uk');

    assert.ok(usTermUrls.length >= 2, `US URLs missing on card ${card.id}`);
    assert.ok(ukTermUrls.length >= 2, `UK URLs missing on card ${card.id}`);

    // UK cloud audio for single words / phrases must prioritize British Male voice (type=1)
    if (!/\s/.test(cleanedTerm) || cleanedTerm.length <= 140) {
      const maleUkUrl = ukTermUrls.find((u) => u.includes('dict.youdao.com') && u.includes('type=1'));
      assert.ok(maleUkUrl, `UK Male audio URL missing on card ${card.id} (${card.term})`);
    }

    // 2. Sentences reading audit (Example 1 and Example 2)
    const ex1Clean = cleanEnglishForSpeech(card.exampleEn);
    assert.ok(ex1Clean.length >= 12, `Example 1 too short on card ${card.id}`);
    assert.ok(!/[“”"]/.test(ex1Clean), `Quotes left in Example 1 on ${card.id}`);

    if (card.exampleEn2) {
      const ex2Clean = cleanEnglishForSpeech(card.exampleEn2);
      assert.ok(ex2Clean.length >= 12, `Example 2 too short on card ${card.id}`);
      assert.ok(!/[“”"]/.test(ex2Clean), `Quotes left in Example 2 on ${card.id}`);
      auditedSentences += 2;
    } else {
      auditedSentences += 1;
    }

    auditedTerms++;
  }

  assert.equal(auditedTerms, 172, 'Must audit all 172 cards in the official catalog');
  assert.ok(auditedSentences >= 250, `Audited at least 250 native sentences (got ${auditedSentences})`);
});
