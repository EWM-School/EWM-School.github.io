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
  analyzeBritishRpFeatures,
  buildBritishRpSsml,
  buildGeminiTtsDirective,
  normalizeBritishOrthography,
  prepareBritishWebSpeechText,
} from './phoneticNormalizer';
import {
  buildNativeCloudAudioUrls,
  cleanEnglishForSpeech,
  cleanSpeechSearchQuery,
  compareUsAndUkSpeech,
  computeUtteranceTuning,
  estimateSpeechSafetyTimeoutMs,
  getSelectedVoiceLocale,
  selectBestEnglishVoice,
  setSpeechSpeed,
  speakEnglishText,
  stopCurrentAudio,
  subscribeAudioPlayback,
  switchVoiceLocale,
  toggleSpeakEnglishText,
  toggleSpeechSpeed,
  type ActiveAudioPlayback,
  type VoiceDescriptor,
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

test('Web Speech API voice selector picks native en-US and male en-GB voices while rejecting Portuguese', () => {
  const sampleVoices: VoiceDescriptor[] = [
    { name: 'Luciana (Brasil)', lang: 'pt-BR' },
    { name: 'Google UK English Female', lang: 'en-GB' },
    { name: 'Google UK English Male', lang: 'en-GB' },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
    { name: 'Google US English', lang: 'en-US' },
  ];

  const pickedUs = selectBestEnglishVoice(sampleVoices, 'us');
  const pickedUk = selectBestEnglishVoice(sampleVoices, 'uk');

  assert.equal(pickedUs?.name, 'Google US English');
  assert.equal(pickedUs?.lang, 'en-US');
  assert.equal(pickedUk?.name, 'Google UK English Male');
  assert.equal(pickedUk?.lang, 'en-GB');

  // When only Portuguese voices exist, never pick Portuguese
  assert.equal(selectBestEnglishVoice([{ name: 'Luciana', lang: 'pt-BR' }], 'us'), null);
  assert.equal(selectBestEnglishVoice([{ name: 'Luciana', lang: 'pt-BR' }], 'uk'), null);
});

test('Web Speech API utterance tuning & speed toggle calibrate en-US and en-GB parameters', () => {
  setSpeechSpeed('normal');
  const usNormal = computeUtteranceTuning('us', 'normal');
  const ukNormal = computeUtteranceTuning('uk', 'normal');
  const usSlow = computeUtteranceTuning('us', 'slow');
  const ukSlow = computeUtteranceTuning('uk', 'slow');

  assert.equal(usNormal.lang, 'en-US');
  assert.equal(ukNormal.lang, 'en-GB');
  assert.ok(ukNormal.pitch < usNormal.pitch, 'UK voice uses deeper baritone pitch contrast');
  assert.ok(usSlow.rate < usNormal.rate, 'Slow mode reduces US utterance rate');
  assert.ok(ukSlow.rate < ukNormal.rate, 'Slow mode reduces UK utterance rate');

  assert.equal(toggleSpeechSpeed(), 'slow');
  assert.equal(toggleSpeechSpeed(), 'normal');

  const safetyMs = estimateSpeechSafetyTimeoutMs('Wrap up the meeting', 0.94);
  assert.ok(safetyMs >= 3200 && safetyMs <= 24000);
});

test('Web Speech API lifecycle: native en-US/en-GB synthesis, race-free switching, toggle stop & US->UK compare', async () => {
  const spokenLog: Array<{ text: string; lang: string; rate: number; voiceName?: string }> = [];
  let activeMockUtter: MockUtterance | null = null;

  class MockUtterance {
    text: string;
    lang = '';
    rate = 1;
    pitch = 1;
    voice: VoiceDescriptor | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  const mockVoices: VoiceDescriptor[] = [
    { name: 'Samantha', lang: 'en-US' },
    { name: 'Daniel', lang: 'en-GB' },
  ];

  const prevWindow = (globalThis as Record<string, unknown>).window;
  const prevUtter = (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;

  const mockSpeechSynthesis = {
    paused: false,
    getVoices: () => mockVoices,
    resume: () => {},
    cancel: () => {
      const cancelled = activeMockUtter;
      activeMockUtter = null;
      if (cancelled?.onerror) {
        // Simulate Chromium firing async 'canceled' error on the old utterance
        setTimeout(() => {
          cancelled.onerror?.({ error: 'canceled' });
        }, 5);
      }
    },
    speak: (utter: MockUtterance) => {
      activeMockUtter = utter;
      spokenLog.push({
        text: utter.text,
        lang: utter.lang,
        rate: utter.rate,
        voiceName: utter.voice?.name,
      });
      setTimeout(() => {
        if (activeMockUtter === utter) {
          utter.onstart?.();
        }
      }, 2);
      setTimeout(() => {
        if (activeMockUtter === utter) {
          activeMockUtter = null;
          utter.onend?.();
        }
      }, 25);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;
  (globalThis as Record<string, unknown>).window = {
    speechSynthesis: mockSpeechSynthesis,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  const states: Array<ActiveAudioPlayback | null> = [];
  const unsub = subscribeAudioPlayback((s) => states.push(s));

  try {
    // 1. Rapid switch from US to UK must NOT allow US cancellation error to wipe UK state
    const pUs = speakEnglishText('Reschedule', 'us');
    await new Promise((r) => setTimeout(r, 4));
    const pUk = speakEnglishText('Reschedule', 'uk');
    await new Promise((r) => setTimeout(r, 12));
    const latestMidUk = states[states.length - 1];
    assert.equal(latestMidUk?.accent, 'uk', 'Active state must remain UK during UK speech');
    assert.equal(latestMidUk?.engine, 'web-speech');
    await Promise.all([pUs, pUk]);
    assert.equal(states[states.length - 1], null, 'Settles to null after UK finishes');

    // 2. Toggle stop when clicking the same active accent
    const pToggle = toggleSpeakEnglishText('Water', 'us');
    await new Promise((r) => setTimeout(r, 6));
    assert.equal(states[states.length - 1]?.accent, 'us');
    const secondClickResult = await toggleSpeakEnglishText('Water', 'us');
    assert.equal(secondClickResult, false);
    assert.equal(states[states.length - 1], null);
    await pToggle;

    // 3. Sequential comparison US -> UK speaks en-US then en-GB
    spokenLog.length = 0;
    const compared = await compareUsAndUkSpeech('Schedule', 'Schedule', { speed: 'slow' });
    assert.equal(compared, true);
    assert.equal(spokenLog.length, 2);
    assert.equal(spokenLog[0].lang, 'en-US');
    assert.equal(spokenLog[0].voiceName, 'Samantha');
    assert.equal(spokenLog[1].lang, 'en-GB');
    assert.equal(spokenLog[1].voiceName, 'Daniel');
    assert.ok(spokenLog[0].rate < 0.7 && spokenLog[1].rate < 0.7);
  } finally {
    stopCurrentAudio();
    unsub();
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
    if (prevUtter === undefined) {
      delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
    } else {
      (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = prevUtter;
    }
  }
});

test('Strict en-GB vs en-US locale isolation never leaks cross-locale or eSpeak voices', () => {
  // Device with ONLY US, Australian, Irish, Portuguese, and robotic eSpeak voices -> UK must return null!
  const nonUkDeviceVoices: VoiceDescriptor[] = [
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Karen', lang: 'en-AU' },
    { name: 'Moira', lang: 'en-IE' },
    { name: 'Luciana', lang: 'pt-BR' },
    { name: 'eSpeak en-GB', lang: 'en-GB' },
  ];
  assert.equal(
    selectBestEnglishVoice(nonUkDeviceVoices, 'uk'),
    null,
    'Must return null rather than leaking en-US, en-AU, en-IE, or robotic eSpeak when en-GB is requested'
  );
  assert.equal(selectBestEnglishVoice(nonUkDeviceVoices, 'us')?.name, 'Google US English');

  // Device with ONLY UK voices -> US must return null rather than leaking en-GB!
  const ukOnlyVoices: VoiceDescriptor[] = [
    { name: 'Google UK English Female', lang: 'en-GB' },
  ];
  assert.equal(selectBestEnglishVoice(ukOnlyVoices, 'uk')?.name, 'Google UK English Female');
  assert.equal(selectBestEnglishVoice(ukOnlyVoices, 'us'), null);
});

test('phoneticNormalizer: British orthography, G2P respelling, SSML IPA tags, Linking-R & Gemini RP directives', () => {
  assert.equal(
    normalizeBritishOrthography('My favorite color in the center of the theater, traveling to organize.'),
    'My favourite colour in the centre of the theatre, travelling to organise.'
  );

  assert.equal(
    prepareBritishWebSpeechText('Can we reschedule the lieutenant schedule?'),
    'Can we reshedule the leftenant shedule?'
  );

  const ssml = buildBritishRpSsml(
    'Please reschedule: check the herb, vitamin, privacy, tomato, garage, and either route.',
    'normal'
  );
  assert.match(ssml, /xml:lang="en-GB"/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="ˌriːˈʃɛdjuːl">reschedule<\/phoneme>/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="hɜːb">herb<\/phoneme>/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="ˈvɪtəmɪn">vitamin<\/phoneme>/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="ˈprɪvəsi">privacy<\/phoneme>/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="təˈmɑːtəʊ">tomato<\/phoneme>/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="ˈɡærɑːʒ">garage<\/phoneme>/);
  assert.match(ssml, /<phoneme alphabet="ipa" ph="ˈaɪðə">either<\/phoneme>/);

  const rpFeatures = analyzeBritishRpFeatures("It's a matter of asking for a glass of water on Tuesday.");
  assert.ok(
    rpFeatures.linkingRPairs.some((p) => p.leftWord === 'matter' && p.rightWord === 'of'),
    'Detects natural British linking-R across "matter of"'
  );
  assert.ok(
    rpFeatures.linkingRPairs.some((p) => p.leftWord === 'for' && p.rightWord === 'a'),
    'Detects natural British linking-R across "for a"'
  );

  const ukDirective = buildGeminiTtsDirective(
    "Can't we reschedule a new student duty for Tuesday?",
    'uk',
    'slow'
  );
  assert.equal(ukDirective.languageCode, 'en-GB');
  assert.equal(ukDirective.voiceName, 'Charon');
  assert.match(ukDirective.systemInstruction, /Non-rhoticity/);
  assert.match(ukDirective.systemInstruction, /TRAP-BATH Split/);
  assert.match(ukDirective.systemInstruction, /Crisp Alveolar \/t\//);
  assert.match(ukDirective.systemInstruction, /LOT & THOUGHT Vowels/);
  assert.match(ukDirective.systemInstruction, /Yod-Retention/);
  assert.match(ukDirective.speechStyle, /reschedule/);

  const usDirective = buildGeminiTtsDirective('Water bottle', 'us', 'normal');
  assert.equal(usDirective.languageCode, 'en-US');
  assert.equal(usDirective.voiceName, 'Kore');
});

test('Missing local en-GB voice pack never speaks with en-US Web Speech and automatically routes to Gemini TTS', async () => {
  let webSpeechSpeakCalled = false;
  const geminiFetchPayloads: Array<Record<string, unknown>> = [];

  class MockUtterance {
    text: string;
    lang = '';
    rate = 1;
    pitch = 1;
    voice: VoiceDescriptor | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  const prevWindow = (globalThis as Record<string, unknown>).window;
  const prevDocument = (globalThis as Record<string, unknown>).document;
  const prevFetch = (globalThis as Record<string, unknown>).fetch;
  const prevUtter = (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;

  // Browser ONLY has American English installed locally (no en-GB pack!)
  const usOnlyVoices: VoiceDescriptor[] = [
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
  ];

  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;
  (globalThis as Record<string, unknown>).window = {
    speechSynthesis: {
      paused: false,
      getVoices: () => usOnlyVoices,
      resume: () => {},
      cancel: () => {},
      speak: () => {
        webSpeechSpeakCalled = true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  (globalThis as Record<string, unknown>).document = {
    createElement: () => {
      const mockAudio = {
        preload: '',
        playbackRate: 1,
        src: '',
        onplaying: null as (() => void) | null,
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
        setAttribute: () => {},
        pause: () => {},
        play: () => {
          setTimeout(() => mockAudio.onplaying?.(), 2);
          setTimeout(() => mockAudio.onended?.(), 15);
          return Promise.resolve();
        },
      };
      return mockAudio;
    },
  };

  (globalThis as Record<string, unknown>).fetch = async (_url: string, init?: { body?: string }) => {
    if (init?.body) {
      geminiFetchPayloads.push(JSON.parse(init.body) as Record<string, unknown>);
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        mimeType: 'audio/wav',
        audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
        locale: 'en-GB',
        voiceName: 'Charon',
      }),
    };
  };

  try {
    const ok = await speakEnglishText('Can we reschedule?', 'uk');
    assert.equal(ok, true, 'Gemini Neural TTS fallback succeeds cleanly');
    assert.equal(
      webSpeechSpeakCalled,
      false,
      'Web Speech MUST NOT be called when en-GB local voice pack is missing (zero en-US leakage)'
    );
    assert.equal(geminiFetchPayloads.length, 1);
    assert.equal(geminiFetchPayloads[0].accent, 'uk');
    assert.equal(getSelectedVoiceLocale(), 'uk');

    // Switching locale back to US updates global state cleanly
    switchVoiceLocale('us');
    assert.equal(getSelectedVoiceLocale(), 'us');
  } finally {
    stopCurrentAudio();
    if (prevWindow === undefined) delete (globalThis as Record<string, unknown>).window;
    else (globalThis as Record<string, unknown>).window = prevWindow;
    if (prevDocument === undefined) delete (globalThis as Record<string, unknown>).document;
    else (globalThis as Record<string, unknown>).document = prevDocument;
    if (prevFetch === undefined) delete (globalThis as Record<string, unknown>).fetch;
    else (globalThis as Record<string, unknown>).fetch = prevFetch;
    if (prevUtter === undefined) {
      delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
    } else {
      (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = prevUtter;
    }
  }
});

test('Target RP benchmark sentence enforces all 6 British RP rules: TRAP-BATH, Yod-retention, Linking-R, Crisp /t/, Non-rhoticity & /ʃɛdjuːl/', () => {
  const benchmark =
    "Can't you ask the new student for a glass of water on Tuesday schedule?";

  const analysis = analyzeBritishRpFeatures(benchmark);
  const ipaMap = new Map(
    analysis.matchedIpaHints.map((h) => [h.word.toLowerCase(), h.ipa])
  );

  assert.equal(ipaMap.get("can't"), '/kɑːnt/');
  assert.equal(ipaMap.get('ask'), '/ɑːsk/');
  assert.equal(ipaMap.get('new'), '/njuː/');
  assert.equal(ipaMap.get('student'), '/ˈstjuːdnt/');
  assert.equal(ipaMap.get('glass'), '/ɡlɑːs/');
  assert.equal(ipaMap.get('water'), '/ˈwɔːtə/');
  assert.equal(ipaMap.get('tuesday'), '/ˈtjuːzdeɪ/');
  assert.equal(ipaMap.get('schedule'), '/ˈʃɛdjuːl/');
  assert.ok(
    analysis.linkingRPairs.some((p) => p.leftWord === 'for' && p.rightWord === 'a'),
    'Detects Linking-R across "for a"'
  );

  const webSpeechText = prepareBritishWebSpeechText(benchmark);
  assert.match(webSpeechText, /shedule\?$/);

  const directive = buildGeminiTtsDirective(benchmark, 'uk', 'normal');
  assert.equal(directive.languageCode, 'en-GB');
  assert.equal(directive.voiceName, 'Charon');
  assert.match(directive.speechStyle, /"Can't" as \/kɑːnt\//);
  assert.match(directive.speechStyle, /"glass" as \/ɡlɑːs\//);
  assert.match(directive.speechStyle, /"water" as \/ˈwɔːtə\//);
  assert.match(directive.speechStyle, /"Tuesday" as \/ˈtjuːzdeɪ\//);
  assert.match(directive.speechStyle, /"schedule" as \/ˈʃɛdjuːl\//);
  assert.match(directive.speechStyle, /"for a"/);
});


