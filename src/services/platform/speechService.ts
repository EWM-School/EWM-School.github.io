import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Preferences } from '@capacitor/preferences';
import type { EnglishAccent } from '../../types/flashcard';
import {
  LOCALE_SPEECH_PROFILES,
  buildBritishRpSsml,
  buildGeminiTtsDirective,
  isHighQualityNeuralBritishVoice,
  isRoboticFallbackSynthVoice,
  isStrictAmericanVoice,
  isStrictBritishVoice,
  normalizeBritishOrthography,
  normalizeVoiceLangTag,
  prepareBritishWebSpeechText,
} from '../../utils/phoneticNormalizer';

export type SpeechSpeed = 'normal' | 'slow';
export type AudioEngineSource =
  | 'native-tts'
  | 'web-speech'
  | 'gemini-tts'
  | 'cloud-fallback';

export interface ActiveAudioPlayback {
  text: string;
  accent: EnglishAccent;
  locale: 'en-US' | 'en-GB';
  speed?: SpeechSpeed;
  isComparing?: boolean;
  engine?: AudioEngineSource;
  voiceName?: string;
}

export interface SpeakOptions {
  speed?: SpeechSpeed;
  rateOverride?: number;
  isComparing?: boolean;
  preferGeminiNeural?: boolean;
}

export interface VoiceDescriptor {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

type AudioStateListener = (active: ActiveAudioPlayback | null) => void;
type SpeechSpeedListener = (speed: SpeechSpeed) => void;
type VoiceLocaleListener = (accent: EnglishAccent) => void;

const SPEECH_SPEED_STORAGE_KEY = 'ewm_v5_speech_speed';
const VOICE_LOCALE_STORAGE_KEY = 'ewm_v5_voice_locale';

/**
 * Isolated per-locale voice registries — `us` (`en-US`) and `uk` (`en-GB`) never share state.
 */
interface IsolatedVoiceRegistry {
  readonly bcp47: 'en-US' | 'en-GB';
  selectedVoice: SpeechSynthesisVoice | null;
  availableVoices: SpeechSynthesisVoice[];
}

const usVoiceRegistry: IsolatedVoiceRegistry = {
  bcp47: 'en-US',
  selectedVoice: null,
  availableVoices: [],
};

const ukVoiceRegistry: IsolatedVoiceRegistry = {
  bcp47: 'en-GB',
  selectedVoice: null,
  availableVoices: [],
};

/**
 * Cached native mobile voice indices per locale (`@capacitor-community/text-to-speech`).
 */
const nativeVoiceIndexCache: {
  initialized: boolean;
  usIndex?: number;
  usName?: string;
  ukIndex?: number;
  ukName?: string;
} = {
  initialized: false,
};

let activeAudioElement: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeGeminiAbortController: AbortController | null = null;
let currentPlaybackToken = 0;
const pendingCancelResolvers = new Set<() => void>();

let currentPlayback: ActiveAudioPlayback | null = null;
let currentSpeed: SpeechSpeed = loadInitialSpeechSpeed();
let selectedVoiceLocale: EnglishAccent = loadInitialVoiceLocale();

const listeners = new Set<AudioStateListener>();
const speedListeners = new Set<SpeechSpeedListener>();
const localeListeners = new Set<VoiceLocaleListener>();

const dictionaryHumanAudioCache = new Map<string, { usUrl?: string; ukUrl?: string }>();
const geminiClientAudioCache = new Map<string, { dataUrl: string; voiceName: string }>();
const MAX_CLIENT_GEMINI_AUDIO_CACHE = 80;

function loadInitialSpeechSpeed(): SpeechSpeed {
  if (typeof window === 'undefined') return 'normal';
  try {
    const saved = window.localStorage.getItem(SPEECH_SPEED_STORAGE_KEY);
    if (saved === 'slow' || saved === 'normal') return saved;
  } catch {
    // ignore storage errors
  }
  return 'normal';
}

function loadInitialVoiceLocale(): EnglishAccent {
  if (typeof window === 'undefined') return 'us';
  try {
    const saved = window.localStorage.getItem(VOICE_LOCALE_STORAGE_KEY);
    if (saved === 'uk' || saved === 'us') return saved;
  } catch {
    // ignore storage errors
  }
  return 'us';
}

// Hydrate from native Capacitor Preferences asynchronously without blocking boot
if (typeof window !== 'undefined') {
  void Preferences.get({ key: SPEECH_SPEED_STORAGE_KEY })
    .then(({ value }) => {
      if ((value === 'slow' || value === 'normal') && value !== currentSpeed) {
        currentSpeed = value;
        speedListeners.forEach((fn) => {
          try {
            fn(currentSpeed);
          } catch {
            // ignore
          }
        });
      }
    })
    .catch(() => {});

  void Preferences.get({ key: VOICE_LOCALE_STORAGE_KEY })
    .then(({ value }) => {
      if ((value === 'us' || value === 'uk') && value !== selectedVoiceLocale) {
        selectedVoiceLocale = value;
        notifyLocaleListeners(selectedVoiceLocale);
      }
    })
    .catch(() => {});
}

function notifyListeners(next: ActiveAudioPlayback | null): void {
  currentPlayback = next;
  listeners.forEach((fn) => {
    try {
      fn(currentPlayback);
    } catch {
      // ignore subscriber errors
    }
  });
}

function notifyLocaleListeners(accent: EnglishAccent): void {
  localeListeners.forEach((fn) => {
    try {
      fn(accent);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeAudioPlayback(listener: AudioStateListener): () => void {
  listeners.add(listener);
  listener(currentPlayback);
  return () => {
    listeners.delete(listener);
  };
}

export function getSelectedVoiceLocale(): EnglishAccent {
  return selectedVoiceLocale;
}

/**
 * Explicitly switches the active voice package (`us` <-> `uk`), immediately cancelling
 * any queued/in-flight playback so states never overlap or leak across locales.
 */
export function switchVoiceLocale(
  nextAccent: EnglishAccent,
  options?: { preserveComparison?: boolean }
): void {
  if (nextAccent !== 'us' && nextAccent !== 'uk') return;
  const changed = selectedVoiceLocale !== nextAccent;
  selectedVoiceLocale = nextAccent;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOICE_LOCALE_STORAGE_KEY, nextAccent);
    } catch {
      // ignore storage errors
    }
    void Preferences.set({ key: VOICE_LOCALE_STORAGE_KEY, value: nextAccent }).catch(() => {});
  }
  if (
    changed &&
    !options?.preserveComparison &&
    currentPlayback &&
    currentPlayback.accent !== nextAccent
  ) {
    stopCurrentAudio();
  }
  notifyLocaleListeners(selectedVoiceLocale);
}

export function subscribeVoiceLocale(listener: VoiceLocaleListener): () => void {
  localeListeners.add(listener);
  listener(selectedVoiceLocale);
  return () => {
    localeListeners.delete(listener);
  };
}

export function getSpeechSpeed(): SpeechSpeed {
  return currentSpeed;
}

export function setSpeechSpeed(next: SpeechSpeed): void {
  if (next !== 'normal' && next !== 'slow') return;
  currentSpeed = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SPEECH_SPEED_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    void Preferences.set({ key: SPEECH_SPEED_STORAGE_KEY, value: next }).catch(() => {});
  }
  speedListeners.forEach((fn) => {
    try {
      fn(currentSpeed);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function toggleSpeechSpeed(): SpeechSpeed {
  const next: SpeechSpeed = currentSpeed === 'normal' ? 'slow' : 'normal';
  setSpeechSpeed(next);
  return next;
}

export function subscribeSpeechSpeed(listener: SpeechSpeedListener): () => void {
  speedListeners.add(listener);
  listener(currentSpeed);
  return () => {
    speedListeners.delete(listener);
  };
}

export function isWebSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function registerDictionaryAudioUrls(
  word: string,
  urls: { usUrl?: string; ukUrl?: string }
): void {
  const key = String(word || '').trim().toLowerCase();
  if (!key) return;
  const existing = dictionaryHumanAudioCache.get(key) || {};
  dictionaryHumanAudioCache.set(key, {
    usUrl: urls.usUrl || existing.usUrl,
    ukUrl: urls.ukUrl || existing.ukUrl,
  });
}

export function isNonEnglishOrPortugueseVoice(
  voice: VoiceDescriptor | null | undefined
): boolean {
  if (!voice) return true;
  if (isRoboticFallbackSynthVoice(voice)) return true;
  const lang = String(voice.lang || '').toLowerCase();
  const name = String(voice.name || '').toLowerCase();
  if (!lang.startsWith('en')) return true;
  return (
    lang.startsWith('pt') ||
    name.includes('portugu') ||
    name.includes('brasil') ||
    name.includes('brazil') ||
    name.includes('luciana') ||
    name.includes('daniel (portuguese)')
  );
}

/**
 * Strictly isolated voice selector for `en-US` and `en-GB`:
 * - `uk` (`en-GB`): ONLY accepts genuine `en-GB` voices (`normalizeVoiceLangTag(v.lang) === 'en-GB'`).
 * - `us` (`en-US`): ONLY accepts genuine `en-US` voices (`normalizeVoiceLangTag(v.lang) === 'en-US'`).
 */
export function selectBestEnglishVoice<T extends VoiceDescriptor>(
  voices: readonly T[],
  accent: EnglishAccent
): T | null {
  if (!voices || voices.length === 0) return null;

  if (accent === 'uk') {
    const strictUkVoices = voices.filter((v) => isStrictBritishVoice(v));
    if (strictUkVoices.length === 0) return null;

    const ukPriorityTiers: Array<(v: T) => boolean> = [
      (v) =>
        isHighQualityNeuralBritishVoice(v) &&
        /google uk english male|\b(ryan|thomas|alfie|george|oliver|daniel|arthur)\b/i.test(v.name) &&
        !/female|sonia|libby|maisie|serena|kate|hazel/i.test(v.name),
      (v) =>
        isHighQualityNeuralBritishVoice(v) &&
        /google uk english female|\b(sonia|libby|maisie|serena)\b/i.test(v.name),
      (v) =>
        /\b(male|ryan|george|oliver|daniel|arthur|thomas|brian|william|alfie|harry|charles)\b/i.test(
          v.name
        ) && !/female|sonia|libby|maisie|serena|martha|kate|hazel/i.test(v.name),
      (v) => isHighQualityNeuralBritishVoice(v),
      () => true,
    ];

    for (const matchesTier of ukPriorityTiers) {
      const found = strictUkVoices.find(matchesTier);
      if (found) return found;
    }
    return null;
  }

  const strictUsVoices = voices.filter((v) => isStrictAmericanVoice(v));
  if (strictUsVoices.length === 0) return null;

  const usPriorityTiers: Array<(v: T) => boolean> = [
    (v) =>
      /google us english|online \(natural\)|natural|\b(aria|jenny|ava|andrew|emma|christopher|guy|steffan|samantha|alex|allison)\b/i.test(
        v.name
      ),
    (v) => /google|microsoft|apple|zira|david/i.test(v.name),
    () => true,
  ];

  for (const matchesTier of usPriorityTiers) {
    const found = strictUsVoices.find(matchesTier);
    if (found) return found;
  }
  return null;
}

export function computeUtteranceTuning(
  accent: EnglishAccent,
  speed: SpeechSpeed = 'normal'
): { lang: 'en-US' | 'en-GB'; rate: number; pitch: number } {
  const profile = LOCALE_SPEECH_PROFILES[accent];
  return {
    lang: profile.bcp47,
    rate: speed === 'slow' ? profile.webSpeechSlowRate : profile.webSpeechNormalRate,
    pitch: profile.webSpeechPitch,
  };
}

export function estimateSpeechSafetyTimeoutMs(cleanedText: string, rate: number): number {
  const safeRate = Math.max(0.5, rate || 0.9);
  const estimated = Math.ceil((cleanedText.length / safeRate) * 115) + 2400;
  return Math.max(3200, Math.min(24000, estimated));
}

function refreshIsolatedVoiceRegistries(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const allVoices = window.speechSynthesis.getVoices() || [];
    usVoiceRegistry.availableVoices = allVoices.filter((v) => isStrictAmericanVoice(v));
    ukVoiceRegistry.availableVoices = allVoices.filter((v) => isStrictBritishVoice(v));
    usVoiceRegistry.selectedVoice = selectBestEnglishVoice(usVoiceRegistry.availableVoices, 'us');
    ukVoiceRegistry.selectedVoice = selectBestEnglishVoice(ukVoiceRegistry.availableVoices, 'uk');
  } catch {
    // ignore voice enumeration errors
  }
}

if (
  typeof window !== 'undefined' &&
  !Capacitor.isNativePlatform() &&
  'speechSynthesis' in window
) {
  refreshIsolatedVoiceRegistries();
  try {
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', refreshIsolatedVoiceRegistries);
    } else {
      window.speechSynthesis.onvoiceschanged = refreshIsolatedVoiceRegistries;
    }
  } catch {
    // ignore listener errors on legacy engines
  }
}

export function pickNativeEnglishVoice(accent: EnglishAccent): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  refreshIsolatedVoiceRegistries();
  return accent === 'uk' ? ukVoiceRegistry.selectedVoice : usVoiceRegistry.selectedVoice;
}

export function pickAmericanEnglishVoice(): SpeechSynthesisVoice | null {
  return pickNativeEnglishVoice('us');
}

export function pickBritishEnglishVoice(): SpeechSynthesisVoice | null {
  return pickNativeEnglishVoice('uk');
}

/**
 * Cleans English text for TTS while strictly preserving internal apostrophes in contractions.
 */
export function cleanEnglishForSpeech(rawText: string): string {
  return String(rawText || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/…|\.{3,}/g, '')
    .replace(/([a-zA-Z])[’‘]([a-zA-Z])/g, "$1'$2")
    .replace(/[“”"]/g, '')
    .replace(/(^|\s)['’‘]+|['’‘]+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildNativeCloudAudioUrls(cleanedText: string, accent: EnglishAccent): string[] {
  const urls: string[] = [];
  const localeNormalized =
    accent === 'uk' ? normalizeBritishOrthography(cleanedText) : cleanedText;
  const lowerSingleWord = localeNormalized.toLowerCase().replace(/[.!?,;:]+$/g, '').trim();

  if (!/\s/.test(lowerSingleWord)) {
    const humanCached =
      dictionaryHumanAudioCache.get(lowerSingleWord) ||
      dictionaryHumanAudioCache.get(cleanedText.toLowerCase().replace(/[.!?,;:]+$/g, '').trim());
    const humanUrl = accent === 'uk' ? humanCached?.ukUrl : humanCached?.usUrl;
    if (humanUrl) {
      urls.push(humanUrl);
    }
  }

  const tl = accent === 'uk' ? 'en-GB' : 'en-US';
  const q = encodeURIComponent(localeNormalized);
  const youdaoSafe = localeNormalized.replace(/[?!;:]+/g, '').trim();

  if (accent === 'uk') {
    if (youdaoSafe && youdaoSafe.length <= 140) {
      urls.push(
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(youdaoSafe)}&type=1`
      );
    }
    urls.push(
      `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${tl}&dt=t&q=${q}`
    );
    urls.push(
      `https://translate.googleapis.com/translate_tts?client=tw-ob&ie=UTF-8&tl=${tl}&q=${q}`
    );
    return urls;
  }

  urls.push(
    `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${tl}&dt=t&q=${q}`
  );
  urls.push(
    `https://translate.googleapis.com/translate_tts?client=tw-ob&ie=UTF-8&tl=${tl}&q=${q}`
  );
  if (youdaoSafe && youdaoSafe.length <= 140) {
    urls.push(
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(youdaoSafe)}&type=2`
    );
  }

  return urls;
}

function flushPendingCancelResolvers(): void {
  if (pendingCancelResolvers.size === 0) return;
  const callbacks = Array.from(pendingCancelResolvers);
  pendingCancelResolvers.clear();
  for (const cancel of callbacks) {
    try {
      cancel();
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Immediately halts all active native TTS, Web Speech utterances, neural fetches, and HTML5 audio queues.
 */
export function stopCurrentAudio(): void {
  currentPlaybackToken++;

  if (Capacitor.isNativePlatform()) {
    void TextToSpeech.stop().catch(() => {});
  }

  if (activeGeminiAbortController) {
    try {
      activeGeminiAbortController.abort();
    } catch {
      // ignore abort errors
    }
    activeGeminiAbortController = null;
  }

  flushPendingCancelResolvers();

  if (activeUtterance) {
    activeUtterance.onstart = null;
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.onplaying = null;
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.src = '';
    } catch {
      // ignore cleanup errors
    }
    activeAudioElement = null;
  }

  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform() && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch {
      // ignore cleanup errors
    }
  }

  notifyListeners(null);
}

async function resolveNativeMobileVoiceIndices(): Promise<void> {
  if (nativeVoiceIndexCache.initialized || !Capacitor.isNativePlatform()) return;
  nativeVoiceIndexCache.initialized = true;
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    if (!Array.isArray(voices) || voices.length === 0) return;

    const indexed = voices.map((v, index) => ({
      index,
      name: String(v.name || v.voiceURI || `Voice ${index}`),
      lang: String(v.lang || ''),
      localService: v.localService,
      default: v.default,
    }));

    const bestUs = selectBestEnglishVoice(indexed, 'us');
    if (bestUs) {
      nativeVoiceIndexCache.usIndex = bestUs.index;
      nativeVoiceIndexCache.usName = bestUs.name;
    }

    const bestUk = selectBestEnglishVoice(indexed, 'uk');
    if (bestUk) {
      nativeVoiceIndexCache.ukIndex = bestUk.index;
      nativeVoiceIndexCache.ukName = bestUk.name;
    }
  } catch {
    // Some OS TTS engines only accept `lang` without enumerating voice indices; safe to ignore
  }
}

/**
 * Native Mobile TTS Engine (`@capacitor-community/text-to-speech`) for Android & iOS.
 * Enforces strict `en-US` vs `en-GB` locale separation + British RP phonetic normalization.
 */
async function playNativeMobileTTS(
  cleanedText: string,
  accent: EnglishAccent,
  speed: SpeechSpeed,
  token: number,
  isComparing: boolean,
  rateOverride?: number
): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || token !== currentPlaybackToken) {
    return false;
  }

  const strictLocale: 'en-US' | 'en-GB' = accent === 'uk' ? 'en-GB' : 'en-US';
  // Maintain full British RP orthography & heteronym normalization ('shedule', 'leftenant', 'colour', etc.)
  const spokenText =
    accent === 'uk' ? prepareBritishWebSpeechText(cleanedText) : cleanedText;
  const rate =
    typeof rateOverride === 'number' && rateOverride > 0
      ? rateOverride
      : speed === 'slow'
      ? 0.72
      : 0.96;
  const pitch = accent === 'uk' ? 0.98 : 1.0;

  await resolveNativeMobileVoiceIndices();
  if (token !== currentPlaybackToken) return false;

  const voiceIndex =
    accent === 'uk' ? nativeVoiceIndexCache.ukIndex : nativeVoiceIndexCache.usIndex;
  const voiceLabel =
    accent === 'uk'
      ? nativeVoiceIndexCache.ukName || 'Native UK (en-GB)'
      : nativeVoiceIndexCache.usName || 'Native US (en-US)';

  notifyListeners({
    text: cleanedText,
    accent,
    locale: strictLocale,
    speed,
    isComparing,
    engine: 'native-tts',
    voiceName: voiceLabel,
  });

  try {
    // Flush any lingering native utterance before starting new card playback
    await TextToSpeech.stop().catch(() => {});
    if (token !== currentPlaybackToken) return false;

    let cancelled = false;
    const onCancel = () => {
      cancelled = true;
      void TextToSpeech.stop().catch(() => {});
    };
    pendingCancelResolvers.add(onCancel);

    try {
      await TextToSpeech.speak({
        text: spokenText,
        lang: strictLocale,
        rate,
        pitch,
        volume: 1.0,
        category: 'playback',
        ...(typeof voiceIndex === 'number' ? { voice: voiceIndex } : {}),
      });
      return !cancelled && token === currentPlaybackToken;
    } finally {
      pendingCancelResolvers.delete(onCancel);
    }
  } catch {
    return false;
  }
}

async function ensureVoicesReady(maxWaitMs = 90): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const immediate = window.speechSynthesis.getVoices() || [];
  if (immediate.length > 0) {
    refreshIsolatedVoiceRegistries();
    return immediate;
  }

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        if (typeof window.speechSynthesis.removeEventListener === 'function') {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
        }
      } catch {
        // ignore
      }
      refreshIsolatedVoiceRegistries();
      resolve(window.speechSynthesis.getVoices() || []);
    };
    const onVoices = () => finish();

    try {
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', onVoices);
      }
    } catch {
      // ignore
    }
    setTimeout(finish, maxWaitMs);
  });
}

function playDataUrlOrSrcAudio(
  src: string,
  playbackRate: number,
  token: number,
  connectTimeoutMs = 3500
): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    if (token !== currentPlaybackToken) {
      resolve(false);
      return;
    }

    const audio = document.createElement('audio');
    audio.setAttribute('referrerpolicy', 'no-referrer');
    audio.preload = 'auto';
    audio.playbackRate = playbackRate;
    activeAudioElement = audio;

    let settled = false;
    let playStarted = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      pendingCancelResolvers.delete(onCancel);
      clearTimeout(connectTimer);
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      if (!ok) {
        try {
          audio.pause();
        } catch {
          // ignore
        }
      }
      if (activeAudioElement === audio) {
        activeAudioElement = null;
      }
      resolve(ok);
    };

    const onCancel = () => finish(false);
    pendingCancelResolvers.add(onCancel);

    const connectTimer = setTimeout(() => {
      if (!playStarted) {
        finish(false);
      }
    }, connectTimeoutMs);

    audio.onplaying = () => {
      if (settled || token !== currentPlaybackToken) {
        finish(false);
        return;
      }
      playStarted = true;
      clearTimeout(connectTimer);
    };

    audio.onended = () => {
      finish(true);
    };

    audio.onerror = () => {
      finish(playStarted);
    };

    audio.src = src;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (!playStarted) {
          finish(false);
        }
      });
    }
  });
}

function resolveTtsApiEndpoint(): string | null {
  const configuredBase = (
    import.meta.env?.VITE_API_BASE_URL as string | undefined
  )?.replace(/\/+$/, '');
  if (Capacitor.isNativePlatform()) {
    // On native mobile, relative `/api/...` points to local WebView bundle; only call AI server if configured
    return configuredBase ? `${configuredBase}/api/gemini/tts` : null;
  }
  return configuredBase ? `${configuredBase}/api/gemini/tts` : '/api/gemini/tts';
}

async function playGeminiNeuralTTS(
  cleanedText: string,
  accent: EnglishAccent,
  speed: SpeechSpeed,
  token: number,
  isComparing: boolean,
  rateOverride?: number
): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof fetch !== 'function' ||
    token !== currentPlaybackToken ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return false;
  }

  const endpoint = resolveTtsApiEndpoint();
  if (!endpoint) return false;

  const effectivePlaybackRate =
    typeof rateOverride === 'number' && rateOverride > 0 ? rateOverride : 1.0;

  const directive = buildGeminiTtsDirective(cleanedText, accent, speed);
  const cacheKey = `${directive.languageCode}|${speed}|${directive.normalizedText.toLowerCase()}`;
  const cached = geminiClientAudioCache.get(cacheKey);

  if (cached) {
    notifyListeners({
      text: cleanedText,
      accent,
      locale: directive.languageCode,
      speed,
      isComparing,
      engine: 'gemini-tts',
      voiceName: `Gemini ${cached.voiceName} (${directive.languageCode})`,
    });
    return playDataUrlOrSrcAudio(cached.dataUrl, effectivePlaybackRate, token, 2500);
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  activeGeminiAbortController = controller;

  try {
    notifyListeners({
      text: cleanedText,
      accent,
      locale: directive.languageCode,
      speed,
      isComparing,
      engine: 'gemini-tts',
      voiceName: `Gemini ${directive.voiceName} (${directive.languageCode})`,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanedText,
        accent,
        speed,
      }),
      signal: controller?.signal,
    });

    if (activeGeminiAbortController === controller) {
      activeGeminiAbortController = null;
    }

    if (token !== currentPlaybackToken || !response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      success?: boolean;
      audioBase64?: string;
      mimeType?: string;
      voiceName?: string;
    };

    if (!payload?.success || !payload.audioBase64 || token !== currentPlaybackToken) {
      return false;
    }

    const mimeType = payload.mimeType || 'audio/wav';
    const dataUrl = `data:${mimeType};base64,${payload.audioBase64}`;
    const voiceLabel = payload.voiceName || directive.voiceName;

    if (geminiClientAudioCache.size >= MAX_CLIENT_GEMINI_AUDIO_CACHE) {
      const oldestKey = geminiClientAudioCache.keys().next().value;
      if (oldestKey) geminiClientAudioCache.delete(oldestKey);
    }
    geminiClientAudioCache.set(cacheKey, { dataUrl, voiceName: voiceLabel });

    return playDataUrlOrSrcAudio(dataUrl, effectivePlaybackRate, token, 3000);
  } catch {
    if (activeGeminiAbortController === controller) {
      activeGeminiAbortController = null;
    }
    return false;
  }
}

async function playCloudNativeTTS(
  cleanedText: string,
  accent: EnglishAccent,
  speed: SpeechSpeed,
  token: number,
  rateOverride?: number
): Promise<boolean> {
  if (
    typeof document === 'undefined' ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return false;
  }
  const urls = buildNativeCloudAudioUrls(cleanedText, accent);
  const rate =
    typeof rateOverride === 'number' && rateOverride > 0
      ? rateOverride
      : speed === 'slow'
      ? 0.72
      : 1.0;

  for (const url of urls) {
    if (token !== currentPlaybackToken) return false;
    const ok = await playDataUrlOrSrcAudio(url, rate, token, 1500);
    if (ok) return true;
  }
  return false;
}

function waitWithCancel(ms: number, token: number): Promise<boolean> {
  if (ms <= 0 || token !== currentPlaybackToken) {
    return Promise.resolve(token === currentPlaybackToken);
  }
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      pendingCancelResolvers.delete(onCancel);
      clearTimeout(timer);
      resolve(ok);
    };
    const onCancel = () => finish(false);
    const timer = setTimeout(() => finish(token === currentPlaybackToken), ms);
    pendingCancelResolvers.add(onCancel);
  });
}

async function speakSingleSegmentInternal(
  cleaned: string,
  accent: EnglishAccent,
  speed: SpeechSpeed,
  token: number,
  isComparing: boolean,
  preferGeminiNeural = false,
  rateOverride?: number
): Promise<boolean> {
  if (!cleaned || typeof window === 'undefined' || token !== currentPlaybackToken) {
    return false;
  }

  const profile = LOCALE_SPEECH_PROFILES[accent];

  // PATH A: Native Mobile Platform (Android / iOS via @capacitor-community/text-to-speech)
  // Offline-ready, 0ms network dependency, strictly enforcing `en-US` vs `en-GB` + RP normalization.
  if (Capacitor.isNativePlatform()) {
    if (preferGeminiNeural) {
      const neuralOk = await playGeminiNeuralTTS(
        cleaned,
        accent,
        speed,
        token,
        isComparing,
        rateOverride
      );
      if (token !== currentPlaybackToken) return false;
      if (neuralOk) return true;
    }

    const nativeOk = await playNativeMobileTTS(
      cleaned,
      accent,
      speed,
      token,
      isComparing,
      rateOverride
    );
    if (token !== currentPlaybackToken) return false;
    if (nativeOk) return true;

    // Fallback if device lacks offline TTS engine
    const cloudOk = await playCloudNativeTTS(cleaned, accent, speed, token, rateOverride);
    return token === currentPlaybackToken && cloudOk;
  }

  // PATH B: PC / Web Browser Platform
  if (preferGeminiNeural) {
    const neuralOk = await playGeminiNeuralTTS(
      cleaned,
      accent,
      speed,
      token,
      isComparing,
      rateOverride
    );
    if (token !== currentPlaybackToken) return false;
    if (neuralOk) return true;
  }

  if (isWebSpeechSupported()) {
    await ensureVoicesReady(85);
    if (token !== currentPlaybackToken) return false;
  }

  const matchedVoice =
    accent === 'uk' ? ukVoiceRegistry.selectedVoice : usVoiceRegistry.selectedVoice;

  const hasVerifiedLocaleVoice =
    matchedVoice !== null && normalizeVoiceLangTag(matchedVoice.lang) === profile.bcp47;

  if (isWebSpeechSupported() && hasVerifiedLocaleVoice && matchedVoice) {
    const tuning = computeUtteranceTuning(accent, speed);
    const effectiveRate =
      typeof rateOverride === 'number' && rateOverride > 0 ? rateOverride : tuning.rate;
    const spokenText =
      accent === 'uk' ? prepareBritishWebSpeechText(cleaned) : cleaned;

    const _ssml = accent === 'uk' ? buildBritishRpSsml(cleaned, speed) : undefined;
    void _ssml;

    notifyListeners({
      text: cleaned,
      accent,
      locale: tuning.lang,
      speed,
      isComparing,
      engine: 'web-speech',
      voiceName: matchedVoice.name,
    });

    const webSpeechPlayed = await new Promise<boolean>((resolve) => {
      if (token !== currentPlaybackToken) {
        resolve(false);
        return;
      }

      try {
        // Immediate queue flush right before utterance dispatch for fast clicks
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }

        const utter = new SpeechSynthesisUtterance(spokenText);
        utter.lang = tuning.lang;
        try {
          utter.voice = matchedVoice;
        } catch {
          // Keep explicit utter.lang binding
        }
        utter.rate = effectiveRate;
        utter.pitch = tuning.pitch;

        let settled = false;
        let started = false;
        let startProbeTimer: ReturnType<typeof setTimeout> | null = null;
        let safetyTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          pendingCancelResolvers.delete(onCancel);
          if (startProbeTimer !== null) {
            clearTimeout(startProbeTimer);
            startProbeTimer = null;
          }
          if (safetyTimer !== null) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
          }
          utter.onstart = null;
          utter.onend = null;
          utter.onerror = null;
          if (activeUtterance === utter) {
            activeUtterance = null;
          }
          resolve(ok);
        };

        const onCancel = () => finish(false);
        pendingCancelResolvers.add(onCancel);

        utter.onstart = () => {
          if (token !== currentPlaybackToken) {
            finish(false);
            return;
          }
          started = true;
          if (startProbeTimer !== null) {
            clearTimeout(startProbeTimer);
            startProbeTimer = null;
          }
        };

        utter.onend = () => {
          finish(true);
        };

        utter.onerror = () => {
          finish(false);
        };

        activeUtterance = utter;

        const maxDuration = estimateSpeechSafetyTimeoutMs(spokenText, effectiveRate);
        safetyTimer = setTimeout(() => {
          finish(true);
        }, maxDuration);

        startProbeTimer = setTimeout(() => {
          if (!started && token === currentPlaybackToken) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // ignore
            }
            finish(false);
          }
        }, 450);

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utter);
      } catch {
        resolve(false);
      }
    });

    if (token !== currentPlaybackToken) return false;
    if (webSpeechPlayed) return true;
  }

  // Intelligent Neural Fallback via Gemini TTS (`POST /api/gemini/tts`)
  const fallbackStartedAt = Date.now();
  const geminiOk = await playGeminiNeuralTTS(
    cleaned,
    accent,
    speed,
    token,
    isComparing,
    rateOverride
  );
  if (token !== currentPlaybackToken) return false;
  if (geminiOk) return true;

  // Strictly Locale-Locked Cloud Dictionary Fallback
  notifyListeners({
    text: cleaned,
    accent,
    locale: profile.bcp47,
    speed,
    isComparing,
    engine: 'cloud-fallback',
  });

  const cloudOk = await playCloudNativeTTS(cleaned, accent, speed, token, rateOverride);
  if (token !== currentPlaybackToken) return false;

  if (!cloudOk) {
    const elapsed = Date.now() - fallbackStartedAt;
    if (elapsed < 380) {
      await waitWithCancel(380 - elapsed, token);
    }
    return false;
  }

  return true;
}

export async function speakEnglishText(
  text: string,
  accent: EnglishAccent = 'us',
  options?: SpeakOptions
): Promise<boolean> {
  const cleaned = cleanEnglishForSpeech(text);
  if (!cleaned || typeof window === 'undefined') return false;

  switchVoiceLocale(accent);
  stopCurrentAudio();

  const token = ++currentPlaybackToken;
  const speed = options?.speed ?? currentSpeed;
  const isComparing = Boolean(options?.isComparing);
  const preferGeminiNeural = Boolean(options?.preferGeminiNeural);
  const rateOverride = options?.rateOverride;

  const ok = await speakSingleSegmentInternal(
    cleaned,
    accent,
    speed,
    token,
    isComparing,
    preferGeminiNeural,
    rateOverride
  );
  if (token === currentPlaybackToken) {
    notifyListeners(null);
  }
  return ok;
}

export async function toggleSpeakEnglishText(
  text: string,
  accent: EnglishAccent = 'us',
  options?: SpeakOptions
): Promise<boolean> {
  const cleaned = cleanEnglishForSpeech(text);
  if (!cleaned || typeof window === 'undefined') return false;

  if (
    currentPlayback &&
    !currentPlayback.isComparing &&
    currentPlayback.accent === accent &&
    currentPlayback.text === cleaned
  ) {
    stopCurrentAudio();
    return false;
  }

  return speakEnglishText(cleaned, accent, options);
}

export async function compareUsAndUkSpeech(
  usText: string,
  ukText?: string,
  options?: SpeakOptions
): Promise<boolean> {
  const cleanUs = cleanEnglishForSpeech(usText);
  const cleanUk = cleanEnglishForSpeech(ukText || usText);
  if (!cleanUs || typeof window === 'undefined') return false;

  if (
    currentPlayback?.isComparing &&
    (currentPlayback.text === cleanUs || currentPlayback.text === cleanUk)
  ) {
    stopCurrentAudio();
    return false;
  }

  stopCurrentAudio();
  const token = ++currentPlaybackToken;
  const speed = options?.speed ?? currentSpeed;
  const preferGeminiNeural = Boolean(options?.preferGeminiNeural);

  switchVoiceLocale('us', { preserveComparison: true });
  await speakSingleSegmentInternal(cleanUs, 'us', speed, token, true, preferGeminiNeural);
  if (token !== currentPlaybackToken) return false;

  const delayOk = await waitWithCancel(320, token);
  if (!delayOk || token !== currentPlaybackToken) return false;

  switchVoiceLocale('uk', { preserveComparison: true });
  const okUk = await speakSingleSegmentInternal(
    cleanUk,
    'uk',
    speed,
    token,
    true,
    preferGeminiNeural
  );
  if (token === currentPlaybackToken) {
    notifyListeners(null);
  }
  return okUk;
}

export interface SpeechRecognitionController {
  stop: () => void;
  abort: () => void;
}

export interface VoiceSearchOptions {
  lang?: string;
  onStart?: () => void;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

export function cleanSpeechSearchQuery(raw: string): string {
  let text = String(raw || '').trim();
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  text = text.replace(/[.?!,;:]+$/g, '').trim();
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  return text.replace(/\s+/g, ' ');
}

export function startVoiceSearch({
  lang = 'en-US',
  onStart,
  onResult,
  onError,
  onEnd,
}: VoiceSearchOptions): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    onError?.('not-supported');
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionConstructor =
    (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

  try {
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let hasEnded = false;

    recognition.onstart = () => {
      onStart?.();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const text = cleanSpeechSearchQuery(final || interim);
      if (text) {
        onResult(text, Boolean(final));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const error = event.error || 'unknown';
      onError?.(error);
    };

    recognition.onend = () => {
      if (!hasEnded) {
        hasEnded = true;
        onEnd?.();
      }
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
      abort: () => {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      },
    };
  } catch (err) {
    onError?.(err instanceof Error ? err.message : 'error-starting');
    return null;
  }
}
