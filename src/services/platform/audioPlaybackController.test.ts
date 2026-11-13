import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AudioPlaybackController,
  buildTtsCacheKey,
  clearAllAudioCachesForTests,
  clearMemoryAudioCacheForTests,
  getAudioButtonVisualState,
  normalizePcm16WavBytes,
  sanitizeTextForSpeech,
  setCustomPersistentCacheAdapterForTests,
  type ActiveAudioPlayback,
  type PersistedTtsCacheRecord,
  type PersistentTtsCacheAdapter,
} from './audioPlaybackController';

/** Builds a valid minimal 16-bit mono PCM RIFF/WAVE byte array with a known peak sample. */
function createTestPcm16Wav(samples: number[], sampleRate = 24000): Uint8Array {
  const dataBytes = samples.length * 2;
  const totalBytes = 44 + dataBytes;
  const buf = new Uint8Array(totalBytes);
  const view = new DataView(buf.buffer);

  // "RIFF" + size + "WAVE"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, totalBytes - 8, true);
  view.setUint32(8, 0x57415645, false);

  // "fmt " subchunk (16 bytes, PCM=1, mono=1, 16-bit)
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // "data" subchunk
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataBytes, true);

  samples.forEach((sample, idx) => {
    const clamped = Math.max(-32768, Math.min(32767, Math.round(sample)));
    view.setInt16(44 + idx * 2, clamped, true);
  });

  return buf;
}

function readPeakSampleFromWav(wav: Uint8Array): number {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const count = Math.floor((wav.byteLength - 44) / 2);
  let maxAbs = 0;
  for (let i = 0; i < count; i++) {
    const s = Math.abs(view.getInt16(44 + i * 2, true));
    if (s > maxAbs) maxAbs = s;
  }
  return maxAbs;
}

function createInMemoryIdbMock(): {
  adapter: PersistentTtsCacheAdapter;
  records: Map<string, PersistedTtsCacheRecord>;
  getCalls: number;
  setCalls: number;
} {
  const records = new Map<string, PersistedTtsCacheRecord>();
  const state = {
    records,
    getCalls: 0,
    setCalls: 0,
    adapter: {
      async get(key: string) {
        state.getCalls += 1;
        return records.get(key) ?? null;
      },
      async set(record: PersistedTtsCacheRecord) {
        state.setCalls += 1;
        records.set(record.key, record);
      },
      async clear() {
        records.clear();
      },
    },
  };
  return state;
}

interface MockBrowserHarnessOptions {
  online?: boolean;
  playbackDurationMs?: number;
  fetchHandler?: (url: string, init?: RequestInit) => Promise<Response>;
}

function installBrowserAudioHarness(opts: MockBrowserHarnessOptions = {}) {
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  const prevNavigator = g.navigator;
  const prevFetch = g.fetch;
  const prevUtter = g.SpeechSynthesisUtterance;

  const playbackDurationMs = opts.playbackDurationMs ?? 35;

  let activeSoundStreams = 0;
  let maxSimultaneousSoundStreams = 0;
  let htmlAudioPlayCalls = 0;
  let speechSynthesisSpeakCalls = 0;
  let speechSynthesisCancelCalls = 0;
  const createdAudioElements: MockAudioElement[] = [];

  class MockAudioElement {
    public src = '';
    public currentTime = 0;
    public playbackRate = 1.0;
    public defaultPlaybackRate = 1.0;
    public preload = 'auto';
    public onplaying: (() => void) | null = null;
    public onended: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public pauseCalls = 0;
    public loadCalls = 0;
    public removedSrcCount = 0;
    private playTimer: ReturnType<typeof setTimeout> | null = null;
    private isCurrentlyPlaying = false;

    public pause(): void {
      this.pauseCalls += 1;
      if (this.playTimer !== null) {
        clearTimeout(this.playTimer);
        this.playTimer = null;
      }
      if (this.isCurrentlyPlaying) {
        this.isCurrentlyPlaying = false;
        activeSoundStreams = Math.max(0, activeSoundStreams - 1);
      }
    }

    public removeAttribute(attr: string): void {
      if (attr === 'src') {
        this.src = '';
        this.removedSrcCount += 1;
      }
    }

    public load(): void {
      this.loadCalls += 1;
    }

    public async play(): Promise<void> {
      if (!this.src) {
        throw new Error('Cannot play empty src');
      }
      htmlAudioPlayCalls += 1;
      this.isCurrentlyPlaying = true;
      activeSoundStreams += 1;
      if (activeSoundStreams > maxSimultaneousSoundStreams) {
        maxSimultaneousSoundStreams = activeSoundStreams;
      }
      this.onplaying?.();

      this.playTimer = setTimeout(() => {
        this.playTimer = null;
        if (this.isCurrentlyPlaying) {
          this.isCurrentlyPlaying = false;
          activeSoundStreams = Math.max(0, activeSoundStreams - 1);
          this.onended?.();
        }
      }, playbackDurationMs);
    }
  }

  class MockUtterance {
    public text: string;
    public lang = 'en-US';
    public voice: unknown = null;
    public rate = 1;
    public pitch = 1;
    public volume = 1;
    public onstart: (() => void) | null = null;
    public onend: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  let activeSpeechTimer: ReturnType<typeof setTimeout> | null = null;
  let isSpeechActive = false;

  const mockSpeechSynthesis = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [
      { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', localService: false, default: true },
      { name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false, default: false },
    ],
    addEventListener: () => {},
    removeEventListener: () => {},
    resume: () => {},
    cancel: () => {
      speechSynthesisCancelCalls += 1;
      mockSpeechSynthesis.speaking = false;
      mockSpeechSynthesis.pending = false;
      if (activeSpeechTimer !== null) {
        clearTimeout(activeSpeechTimer);
        activeSpeechTimer = null;
      }
      if (isSpeechActive) {
        isSpeechActive = false;
        activeSoundStreams = Math.max(0, activeSoundStreams - 1);
      }
    },
    speak: (utter: MockUtterance) => {
      speechSynthesisSpeakCalls += 1;
      mockSpeechSynthesis.speaking = true;
      isSpeechActive = true;
      activeSoundStreams += 1;
      if (activeSoundStreams > maxSimultaneousSoundStreams) {
        maxSimultaneousSoundStreams = activeSoundStreams;
      }
      utter.onstart?.();
      activeSpeechTimer = setTimeout(() => {
        activeSpeechTimer = null;
        if (isSpeechActive) {
          isSpeechActive = false;
          mockSpeechSynthesis.speaking = false;
          activeSoundStreams = Math.max(0, activeSoundStreams - 1);
          utter.onend?.();
        }
      }, playbackDurationMs);
    },
  };

  const mockNavigator = {
    onLine: opts.online ?? true,
  };

  const mockDocument = {
    createElement: (tag: string) => {
      if (tag === 'audio') {
        const el = new MockAudioElement();
        createdAudioElements.push(el);
        return el;
      }
      return {};
    },
  };

  const storageMap = new Map<string, string>();
  const mockWindow = {
    speechSynthesis: mockSpeechSynthesis,
    localStorage: {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => storageMap.set(k, v),
    },
  };

  const sampleWavBase64 = Buffer.from(createTestPcm16Wav([0, 12000, -12000, 8000])).toString(
    'base64'
  );

  const defaultFetch = async (_url: string, init?: RequestInit): Promise<Response> => {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    return new Response(
      JSON.stringify({
        success: true,
        audioBase64: sampleWavBase64,
        mimeType: 'audio/wav',
        voiceName: 'Kore',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  g.window = mockWindow;
  g.document = mockDocument;
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });
  g.SpeechSynthesisUtterance = MockUtterance;
  g.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    (opts.fetchHandler ?? defaultFetch)(String(input), init);

  return {
    sampleWavBase64,
    createdAudioElements,
    mockNavigator,
    getStats: () => ({
      activeSoundStreams,
      maxSimultaneousSoundStreams,
      htmlAudioPlayCalls,
      speechSynthesisSpeakCalls,
      speechSynthesisCancelCalls,
      audioInstanceCount: createdAudioElements.length,
    }),
    restore: () => {
      if (activeSpeechTimer !== null) clearTimeout(activeSpeechTimer);
      for (const el of createdAudioElements) el.pause();
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
      if (prevDocument === undefined) delete g.document;
      else g.document = prevDocument;
      if (prevNavigator === undefined) {
        delete (g as { navigator?: unknown }).navigator;
      } else {
        Object.defineProperty(globalThis, 'navigator', {
          value: prevNavigator,
          configurable: true,
          writable: true,
        });
      }
      if (prevUtter === undefined) delete g.SpeechSynthesisUtterance;
      else g.SpeechSynthesisUtterance = prevUtter;
      if (prevFetch === undefined) delete g.fetch;
      else g.fetch = prevFetch;
    },
  };
}

test('sanitizeTextForSpeech strips notes, IPA/phonetics, UI translations, and emojis while converting slash variations and preserving contractions', () => {
  // 1. Slash variations become natural didactic pauses (", or ") instead of reading "slash" or gluing words
  assert.equal(
    sanitizeTextForSpeech('hang up / end the call'),
    'hang up, or end the call'
  );
  // Numeric ratios like 24/7 must remain untouched
  assert.equal(sanitizeTextForSpeech('We are open 24/7!'), 'We are open 24/7!');

  // 2. Strips parenthetical & bracketed Portuguese/editorial notes + phonetic transcriptions + emojis
  assert.equal(
    sanitizeTextForSpeech("🇺🇸 Wrap up /rép ÂP/ (informal) [gíria] → Encerrar por hoje"),
    'Wrap up'
  );
  assert.equal(
    sanitizeTextForSpeech('01 · “Let’s call it a day, I’ll catch up tomorrow!” (coloquial) ✨'),
    "Let's call it a day, I'll catch up tomorrow!"
  );

  // 3. Preserves all English contractions (don't, can't, I'll, we're)
  assert.equal(
    sanitizeTextForSpeech("Oh no, hold on—don't hang up, I can't hear you!"),
    "Oh no, hold on, don't hang up, I can't hear you!"
  );
});

test('normalizePcm16WavBytes normalizes quiet and hot 16-bit PCM WAV buffers to uniform -1.5 dBFS studio peak', () => {
  const quietWav = createTestPcm16Wav([0, 4500, -9500, 6200]);
  const normalizedQuiet = normalizePcm16WavBytes(quietWav);
  const quietPeakAfter = readPeakSampleFromWav(normalizedQuiet);
  assert.ok(
    quietPeakAfter >= 27400 && quietPeakAfter <= 27700,
    `Expected studio peak ~27550, got ${quietPeakAfter}`
  );

  const hotWav = createTestPcm16Wav([0, 32600, -32700, 18000]);
  const normalizedHot = normalizePcm16WavBytes(hotWav);
  const hotPeakAfter = readPeakSampleFromWav(normalizedHot);
  assert.ok(
    hotPeakAfter >= 27400 && hotPeakAfter <= 27700,
    `Expected attenuated studio peak ~27550, got ${hotPeakAfter}`
  );
});

test('Cold-start concurrent calls enforce strict mutex: Call #1 is aborted at 0ms and ONLY 1 voice ever plays', async () => {
  const idbMock = createInMemoryIdbMock();
  setCustomPersistentCacheAdapterForTests(idbMock.adapter);
  await clearAllAudioCachesForTests();

  const capturedSignals: AbortSignal[] = [];
  const sampleWavBase64 = Buffer.from(createTestPcm16Wav([0, 14000, -14000])).toString('base64');

  const harness = installBrowserAudioHarness({
    playbackDurationMs: 40,
    fetchHandler: async (_url, init) => {
      const sig = init?.signal as AbortSignal;
      capturedSignals.push(sig);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 90);
        sig?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      });
      return new Response(
        JSON.stringify({
          success: true,
          audioBase64: sampleWavBase64,
          mimeType: 'audio/wav',
          voiceName: 'Kore',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  });

  const controller = new AudioPlaybackController();

  try {
    // Dispatch Call #1 on cold start (network in flight for 90ms)
    const p1 = controller.speak('Wrap up', 'us', {
      role: 'term',
      sourceId: 'card-1-us',
    });

    // Wait 15ms (Call #1 still loading in cold start) then fire Call #2
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(capturedSignals.length, 1);
    assert.equal(capturedSignals[0].aborted, false);

    const p2 = controller.speak('Call it a day', 'uk', {
      role: 'term',
      sourceId: 'card-2-uk',
    });

    // Synchronously at millisecond zero of Call #2, Call #1's AbortController MUST be aborted!
    assert.equal(
      capturedSignals[0].aborted,
      true,
      'First cold-start TTS fetch must be synchronously aborted at 0ms when second call starts'
    );

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.equal(res1, false, 'Aborted first session must resolve false without playing');
    assert.equal(res2, true, 'Latest session must play cleanly to completion');

    const stats = harness.getStats();
    assert.equal(
      stats.maxSimultaneousSoundStreams,
      1,
      'Mathematically impossible for 2 voices to overlap simultaneously'
    );
    assert.equal(stats.htmlAudioPlayCalls, 1, 'Exact 1 HTMLAudioElement playback must occur');
    assert.equal(
      stats.speechSynthesisSpeakCalls,
      0,
      'window.speechSynthesis must NEVER fire during online neural playback'
    );
    assert.equal(
      stats.audioInstanceCount,
      1,
      'Controller must reuse a single HTMLAudioElement instance instead of leaking elements'
    );
  } finally {
    controller.disposeForHmr();
    harness.restore();
    setCustomPersistentCacheAdapterForTests(null);
  }
});

test('Zero overlap between /api/gemini/tts and speechSynthesis on slow cold-start (>500ms) + contingency only on definitive failure', async () => {
  const idbMock = createInMemoryIdbMock();
  setCustomPersistentCacheAdapterForTests(idbMock.adapter);
  await clearAllAudioCachesForTests();

  const sampleWavBase64 = Buffer.from(createTestPcm16Wav([0, 15000, -15000])).toString('base64');
  let shouldFailNetwork = false;

  const harness = installBrowserAudioHarness({
    playbackDurationMs: 30,
    fetchHandler: async (_url, init) => {
      if (shouldFailNetwork) {
        return new Response(JSON.stringify({ error: 'Upstream unavailable' }), { status: 503 });
      }
      // Simulate 520ms cold-start latency (exceeding the legacy 450ms timer that caused dual female voices!)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 520);
        init?.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      });
      return new Response(
        JSON.stringify({
          success: true,
          audioBase64: sampleWavBase64,
          mimeType: 'audio/wav',
          voiceName: 'Kore',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  });

  const controller = new AudioPlaybackController();
  const observedStates: Array<ActiveAudioPlayback | null> = [];
  const unsub = controller.subscribe((st) => observedStates.push(st ? { ...st } : null));

  try {
    const playPromise = controller.speak('Break the ice', 'us', {
      role: 'term',
      sourceId: 'study-main-us',
    });

    // At 480ms (past the old 450ms race window!), neural fetch is still in flight:
    // button state MUST be 'loading' on ONLY 'study-main-us' and speechSynthesis MUST NOT have fired!
    await new Promise((r) => setTimeout(r, 480));
    const current = controller.getActivePlayback();
    assert.equal(current?.status, 'loading');
    assert.equal(
      getAudioButtonVisualState(current, {
        text: 'Break the ice',
        accent: 'us',
        sourceId: 'study-main-us',
      }),
      'loading'
    );
    assert.equal(
      getAudioButtonVisualState(current, {
        text: 'Break the ice',
        accent: 'us',
        sourceId: 'other-card-us',
      }),
      'idle',
      'Only the clicked button may display loading state'
    );
    assert.equal(
      harness.getStats().speechSynthesisSpeakCalls,
      0,
      'speechSynthesis must never race with an in-flight cold-start neural request'
    );

    const ok = await playPromise;
    assert.equal(ok, true);
    assert.equal(harness.getStats().speechSynthesisSpeakCalls, 0);
    assert.equal(harness.getStats().htmlAudioPlayCalls, 1);
    assert.ok(observedStates.some((s) => s?.status === 'loading'));
    assert.ok(observedStates.some((s) => s?.status === 'playing' && s?.engine === 'gemini-tts'));

    // Now simulate definitive neural failure (HTTP 503): speechSynthesis runs strictly sequentially
    shouldFailNetwork = true;
    const fallbackOk = await controller.speak('Piece of cake', 'us', {
      role: 'term',
      sourceId: 'study-fallback-us',
    });
    assert.equal(fallbackOk, true);
    assert.equal(harness.getStats().htmlAudioPlayCalls, 1, 'No second HTMLAudio play on 503');
    assert.equal(
      harness.getStats().speechSynthesisSpeakCalls,
      1,
      'Contingency Web Speech fires exactly once after neural failure'
    );
    assert.equal(harness.getStats().maxSimultaneousSoundStreams, 1);
  } finally {
    unsub();
    controller.disposeForHmr();
    harness.restore();
    setCustomPersistentCacheAdapterForTests(null);
  }
});

test('2-level persistent cache (Memory + IndexedDB) serves repeated plays after F5 reload with 0 network fetches + enforces Minha Voz mutex', async () => {
  const idbMock = createInMemoryIdbMock();
  setCustomPersistentCacheAdapterForTests(idbMock.adapter);
  await clearAllAudioCachesForTests();

  assert.equal(
    buildTtsCacheKey('us', 1.0, '  Let’s   Wrap Up! '),
    "tts_v2:us:1.00:let's wrap up!"
  );

  let networkFetchCount = 0;
  const sampleWavBase64 = Buffer.from(createTestPcm16Wav([0, 11000, -11000])).toString('base64');

  const harness = installBrowserAudioHarness({
    playbackDurationMs: 35,
    fetchHandler: async () => {
      networkFetchCount += 1;
      return new Response(
        JSON.stringify({
          success: true,
          audioBase64: sampleWavBase64,
          mimeType: 'audio/wav',
          voiceName: 'Charon',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  });

  const controller = new AudioPlaybackController();

  try {
    // 1st play: misses cache -> fetches from /api/gemini/tts and writes to IndexedDB
    const firstOk = await controller.speak('Call it a day', 'uk', {
      speed: 'normal',
      role: 'term',
    });
    assert.equal(firstOk, true);
    assert.equal(networkFetchCount, 1);
    assert.equal(idbMock.records.has('tts_v2:uk:1.00:call it a day'), true);

    // Simulate page reload (F5): wipe Level-1 RAM cache while keeping Level-2 IndexedDB intact
    clearMemoryAudioCacheForTests();

    // 2nd play after F5: hits Level-2 IndexedDB cache with ZERO network requests!
    const secondOk = await controller.speak('Call it a day', 'uk', {
      speed: 'normal',
      role: 'term',
    });
    assert.equal(secondOk, true);
    assert.equal(
      networkFetchCount,
      1,
      'Cached expression after F5 reload must play from IndexedDB with 0 network requests'
    );

    // Verify mutual exclusion between `▶️ Minha Voz` (`toggleRecordedBlob`) and native TTS
    const ownVoicePromise = controller.toggleRecordedBlob('blob:https://ewm.local/take-1', {
      sourceId: 'play-own-voice',
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(controller.getActivePlayback()?.role, 'recording');

    // Clicking native TTS while `Minha Voz` is playing must immediately stop `Minha Voz`
    const interruptWithNative = await controller.toggleSpeak('Call it a day', 'uk', {
      speed: 'normal',
      role: 'term',
    });
    const ownVoiceResult = await ownVoicePromise;
    assert.equal(ownVoiceResult, false, 'Interrupted student recording must stop immediately');
    assert.equal(interruptWithNative, true);
    assert.equal(harness.getStats().maxSimultaneousSoundStreams, 1);
  } finally {
    controller.disposeForHmr();
    harness.restore();
    setCustomPersistentCacheAdapterForTests(null);
  }
});
