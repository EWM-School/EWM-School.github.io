import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDigitalSilenceInAudioBytes,
  enforceDeterministicPronunciationInvariants,
  normalizeAudioMimeType,
  stripBase64DataUrlPrefix,
  toSpeakingPhraseDailyKey,
  tokenizeTargetWords,
} from './pronunciationEngine.js';
import {
  getDefaultStudyStats,
  recordSpeakingPracticeInStats,
  computeRealStudentMetrics,
} from './studyMetrics.js';

function createPcm16WavBuffer(samples: number[], sampleRate = 16000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes[offset + i] = str.charCodeAt(i);
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return bytes;
}

test('normalizeAudioMimeType strips codec suffixes for universal cross-platform compatibility', () => {
  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioMimeType('audio/mp4; codecs="mp4a.40.2"'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType('audio/ogg;codecs=opus'), 'audio/ogg');
  assert.equal(normalizeAudioMimeType('audio/wav'), 'audio/wav');
  assert.equal(normalizeAudioMimeType('text/plain'), null);
});

test('stripBase64DataUrlPrefix cleanly extracts base64 payload', () => {
  assert.equal(
    stripBase64DataUrlPrefix('data:audio/webm;codecs=opus;base64,UklGRg=='),
    'UklGRg=='
  );
  assert.equal(stripBase64DataUrlPrefix('  UklGRg== \n'), 'UklGRg==');
});

test('detectDigitalSilenceInAudioBytes rejects silent WAV and accepts active speech wave', () => {
  const silentSamples = new Array(4000).fill(0);
  const silentWav = createPcm16WavBuffer(silentSamples);
  const silentCheck = detectDigitalSilenceInAudioBytes(silentWav, 'audio/wav');
  assert.equal(silentCheck.isSilentOrTooTiny, true);
  assert.equal(silentCheck.reason, 'SILENT_WAV_PCM');

  const voicedSamples = Array.from({ length: 4000 }, (_, i) =>
    Math.sin((2 * Math.PI * 220 * i) / 16000) * 0.35
  );
  const voicedWav = createPcm16WavBuffer(voicedSamples);
  const voicedCheck = detectDigitalSilenceInAudioBytes(voicedWav, 'audio/wav');
  assert.equal(voicedCheck.isSilentOrTooTiny, false);
});

test('Guard 1: Non-CLEAR audioQualityStatus never hallucinates score or approves words', () => {
  const res = enforceDeterministicPronunciationInvariants(
    {
      audioQualityStatus: 'NO_SPEECH_DETECTED',
      heardTranscript: '',
      overallScore: 95,
      verdict: 'NATIVE_LIKE',
      wordBreakdown: [
        { word: 'Wrap', status: 'EXACT', phoneticCuePtBr: 'rép', tipPtBr: 'Ótimo' },
      ],
    },
    'Wrap up',
    'en-US',
    'card-quick'
  );

  assert.equal(res.audioQualityStatus, 'NO_SPEECH_DETECTED');
  assert.equal(res.overallScore, 0);
  assert.equal(res.verdict, 'NEEDS_PRACTICE');
  assert.equal(res.wordBreakdown.length, 0);
});

test('Guard 3: Hardcoded Mathematical Invariant prevents NATIVE_LIKE and caps score <= 84 when any word is MISPRONOUNCED_OR_MISSING', () => {
  const res = enforceDeterministicPronunciationInvariants(
    {
      audioQualityStatus: 'CLEAR',
      heardTranscript: 'She think it worked well today',
      overallScore: 94,
      verdict: 'NATIVE_LIKE',
      wordBreakdown: [
        { word: 'She', status: 'EXACT', phoneticCuePtBr: 'xi', tipPtBr: 'Exato' },
        {
          word: 'thinks',
          status: 'MISPRONOUNCED_OR_MISSING',
          phoneticCuePtBr: 'thínks (/θ/ língua entre os dentes + S final)',
          tipPtBr: 'Coloque a ponta da língua suavemente entre os dentes no TH e pronuncie o S final.',
        },
        { word: 'it', status: 'EXACT', phoneticCuePtBr: 'êt', tipPtBr: 'Exato' },
        {
          word: 'worked',
          status: 'EXACT',
          phoneticCuePtBr: 'wârkt (T seco)',
          tipPtBr: 'Exato',
        },
        { word: 'well', status: 'EXACT', phoneticCuePtBr: 'uél', tipPtBr: 'Exato' },
        { word: 'today', status: 'EXACT', phoneticCuePtBr: 'tchudêi', tipPtBr: 'Exato' },
      ],
    },
    'She thinks it worked well today.',
    'en-US',
    'lab-detailed'
  );

  assert.equal(res.audioQualityStatus, 'CLEAR');
  assert.ok(res.overallScore <= 84, `Expected score <= 84, got ${res.overallScore}`);
  assert.notEqual(res.verdict, 'NATIVE_LIKE');
  assert.equal(res.verdict, 'UNDERSTANDABLE_POLISH');
  assert.equal(res.invariantClamped, true);
  assert.equal(res.wordBreakdown.length, 6);
});

test('tokenizeTargetWords preserves contractions and strips punctuation', () => {
  assert.deepEqual(tokenizeTargetWords("Let's call it a day, folks!"), [
    "Let's",
    'call',
    'it',
    'a',
    'day',
    'folks',
  ]);
});

test('Speaking XP anti-farming lock credits +3 XP, upgrades +2 XP delta to +5 XP, and blocks same-day farming', () => {
  const day1 = new Date('2026-11-12T14:00:00Z');
  const day2 = new Date('2026-11-13T14:00:00Z');
  const key = toSpeakingPhraseDailyKey("Let's call it a day!");
  let stats = getDefaultStudyStats(day1);

  // Attempt 1: UNDERSTANDABLE_POLISH -> +3 XP
  const r1 = recordSpeakingPracticeInStats(key, 'UNDERSTANDABLE_POLISH', stats, day1);
  assert.equal(r1.awardedXp, 3);
  assert.equal(r1.alreadyRewardedToday, false);
  stats = r1.updatedStats;

  // Attempt 2: Repeat UNDERSTANDABLE_POLISH same day -> 0 XP (anti-farming)
  const r2 = recordSpeakingPracticeInStats(key, 'UNDERSTANDABLE_POLISH', stats, day1);
  assert.equal(r2.awardedXp, 0);
  assert.equal(r2.alreadyRewardedToday, true);

  // Attempt 3: Improve to NATIVE_LIKE same day -> +2 XP delta (total 5 XP for that phrase)
  const r3 = recordSpeakingPracticeInStats(key, 'NATIVE_LIKE', stats, day1);
  assert.equal(r3.awardedXp, 2);
  stats = r3.updatedStats;
  assert.equal(stats.monthlySpeakingXp, 5);

  // Attempt 4: Repeat NATIVE_LIKE same day -> 0 XP
  const r4 = recordSpeakingPracticeInStats(key, 'NATIVE_LIKE', stats, day1);
  assert.equal(r4.awardedXp, 0);
  assert.equal(r4.alreadyRewardedToday, true);

  // Next day: unlocks fresh daily practice reward
  const r5 = recordSpeakingPracticeInStats(key, 'NATIVE_LIKE', stats, day2);
  assert.equal(r5.awardedXp, 5);
  assert.equal(r5.updatedStats.monthlySpeakingXp, 10);

  const metrics = computeRealStudentMetrics({ stats: r5.updatedStats });
  assert.ok(metrics.score >= 60);
});
