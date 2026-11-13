import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Preferences } from '@capacitor/preferences';
import { openDB, type IDBPDatabase } from 'idb';
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
  type TtsPedagogicalRole,
} from '../../utils/phoneticNormalizer';

export type SpeechSpeed = 'normal' | 'slow';
export type AudioPlaybackStatus = 'loading' | 'playing';
export type PlaybackRole = 'term' | 'sentence' | 'comparison' | 'recording';

export type AudioEngineSource =
  | 'native-tts'
  | 'web-speech'
  | 'gemini-tts'
  | 'cloud-fallback'
  | 'recorded-blob';

export interface ActiveAudioPlayback {
  playbackId: number;
  status: AudioPlaybackStatus;
  text: string;
  accent: EnglishAccent;
  locale: 'en-US' | 'en-GB';
  speed?: SpeechSpeed;
  role?: PlaybackRole;
  sourceId?: string;
  isComparing?: boolean;
  engine?: AudioEngineSource;
  voiceName?: string;
}

export interface SpeakOptions {
  speed?: SpeechSpeed;
  rateOverride?: number;
  isComparing?: boolean;
  preferGeminiNeural?: boolean;
  role?: TtsPedagogicalRole;
  sourceId?: string;
}

export interface PlayRecordedBlobOptions {
  blob?: Blob | null;
  sourceId?: string;
  accent?: EnglishAccent;
}

export interface VoiceDescriptor {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface PersistedTtsCacheRecord {
  key: string;
  audioBase64: string;
  mimeType: string;
  voiceName: string;
  locale: 'en-US' | 'en-GB';
  updatedAt: number;
}

export interface PersistentTtsCacheAdapter {
  get(key: string): Promise<PersistedTtsCacheRecord | null>;
  set(record: PersistedTtsCacheRecord): Promise<void>;
  clear?(): Promise<void>;
}

type AudioStateListener = (active: ActiveAudioPlayback | null) => void;
type SpeechSpeedListener = (speed: SpeechSpeed) => void;
type VoiceLocaleListener = (accent: EnglishAccent) => void;

const SPEECH_SPEED_STORAGE_KEY = 'ewm_v5_speech_speed';
const VOICE_LOCALE_STORAGE_KEY = 'ewm_v5_voice_locale';

const TTS_IDB_DATABASE_NAME = 'ewm_tts_audio_cache_v2';
const TTS_IDB_DATABASE_VERSION = 1;
const TTS_IDB_STORE_NAME = 'tts_audio';
const MAX_MEMORY_TTS_CACHE_ITEMS = 120;
const MAX_IDB_TTS_CACHE_ITEMS = 240;

/** Target studio peak amplitude (-1.5 dBFS = ~0.841 * 32767) for consistent loudness across words & sentences */
const STUDIO_TARGET_PCM16_PEAK = 27550;
const STUDIO_TARGET_FLOAT_PEAK = 0.84;

// ============================================================================
// 1. PRE-TTS LINGUISTIC SANITIZER & STUDIO LOUDNESS NORMALIZATION
// ============================================================================

/**
 * Sanitizes card terms, idioms, and example sentences before sending to any TTS engine:
 * - Strips coupled UI translation arrows (`→ ...`, `-> ...`) and leading list indices (`01 · `);
 * - Strips phonetic transcriptions (`/rép ÂP/`, `/ˈʃɛd.juːl/`) without harming slash alternatives;
 * - Strips explanatory Portuguese/editorial notes in `(...)` or `[...]` (`(informal)`, `[gíria]`);
 * - Converts alphabetic slash variations (`"hang up / end the call"`) into natural didactic pauses (`", or "`)
 *   while preserving numeric ratios (`"24/7"`, `"50/50"`);
 * - Strips emojis, flag indicators, and decorative UI icons;
 * - Strictly preserves internal English contraction apostrophes (`I'll`, `don't`, `can't`, `let's`).
 */
export function sanitizeTextForSpeech(rawText: string): string {
  let text = String(rawText ?? '');
  if (!text) return '';

  // 1. Strip accidental UI translation suffix after arrow (`Wrap up → Encerrar`)
  text = text.replace(/\s*(?:→|->)\s*.*$/u, ' ');

  // 2. Strip accidental leading card example bullet (`01 · `, `1. `)
  text = text.replace(/^\s*\d{1,2}\s*(?:·|\.\s+|\)\s+)\s*/u, '');

  // 3. Strip slash-enclosed phonetic transcriptions (`/rép ÂP/`, `/ˈʃɛdjuːl/`) before slash-variation parsing
  text = text.replace(
    /(^|[\s([{"“'—–·•])\/(?!\s)[^/\r\n]{1,64}(?<!\s)\/(?=$|[\s)\]}"”'.,!?;:—–·•])/gu,
    '$1 '
  );

  // 4. Strip bracketed and parenthetical editorial/Portuguese notes (`[gíria]`, `(informal)`)
  for (let pass = 0; pass < 2; pass++) {
    text = text.replace(/\[[^\]]*\]/g, ' ');
    text = text.replace(/\([^)]*\)/g, ' ');
  }

  // 5. Normalize curly apostrophes inside contractions (`I’ll` -> `I'll`) and plural possessives (`parents’` -> `parents'`)
  text = text.replace(/([A-Za-z])[’‘ʼ`]([A-Za-z])/g, "$1'$2");
  text = text.replace(/([A-Za-z]s)[’‘ʼ`](?=\s|[.,!?;:]|$)/g, "$1'");

  // 6. Convert alphabetic slash variations into natural didactic pauses (`", or "`), preserving `24/7`
  text = text.replace(/\band\s*\/\s*or\b/gi, 'and or');
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/([A-Za-z'])\s+\/\s+([A-Za-z'])/g, '$1, or $2');
    text = text.replace(/([?!.])\s+\/\s+([A-Za-z'])/g, '$1 Or $2');
  }
  previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/\b([A-Za-z']+)\/([A-Za-z']+)\b/g, '$1, or $2');
  }

  // 7. Strip emojis, country flags, variation selectors, and decorative UI glyphs
  text = text
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ' ')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\uFE0E\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[•·▪▸►★☆✓✔✕✖✗✘]/g, ' ');

  // 8. Convert em-dashes / en-dashes into natural didactic pauses, and strip ellipses & quotes
  text = text
    .replace(/\s*[—–]+\s*/g, ', ')
    .replace(/…|\.{3,}/g, '')
    .replace(/[“”"«»„]/g, '')
    .replace(/(^|\s)['’‘]+|(?<![A-Za-z]s)['’‘]+(?=\s|$)/g, '$1')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/^,\s*|\s*,$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Backward-compatible alias delegating to `sanitizeTextForSpeech`.
 */
export function cleanEnglishForSpeech(rawText: string): string {
  return sanitizeTextForSpeech(rawText);
}

export function normalizeTtsRateKey(
  speed: SpeechSpeed = 'normal',
  rateOverride?: number
): string {
  if (typeof rateOverride === 'number' && Number.isFinite(rateOverride) && rateOverride > 0) {
    return rateOverride.toFixed(2);
  }
  return speed === 'slow' ? '0.70' : '1.00';
}

/**
 * Builds the canonical 2-level cache key: `tts_v2:${accent}:${rate}:${normalizedText}`.
 */
export function buildTtsCacheKey(
  accent: EnglishAccent,
  rate: number | string,
  rawOrNormalizedText: string
): string {
  const safeAccent: EnglishAccent = accent === 'uk' ? 'uk' : 'us';
  const parsedRate = typeof rate === 'number' ? rate : Number(rate);
  const rateStr =
    Number.isFinite(parsedRate) && parsedRate > 0
      ? parsedRate.toFixed(2)
      : String(rate || '1.00').trim() || '1.00';
  const normalized = sanitizeTextForSpeech(rawOrNormalizedText)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return `tts_v2:${safeAccent}:${rateStr}:${normalized}`;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').trim();
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(clean, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  const chunkSize = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

/**
 * Normalizes 16-bit PCM RIFF/WAVE audio bytes to a consistent `-1.5 dBFS` studio peak
 * so isolated words, full sentences, and Speaking Lab models play at uniform loudness.
 */
export function normalizePcm16WavBytes(wavBytes: Uint8Array): Uint8Array {
  if (wavBytes.byteLength < 46) return wavBytes;

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  // Check "RIFF" (0x52494646) and "WAVE" (0x57415645)
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
    return wavBytes;
  }

  let audioFormat = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataByteLength = 0;

  let offset = 12;
  while (offset + 8 <= wavBytes.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const payloadStart = offset + 8;

    if (chunkId === 0x666d7420 && payloadStart + 16 <= wavBytes.byteLength) {
      // "fmt "
      audioFormat = view.getUint16(payloadStart, true);
      bitsPerSample = view.getUint16(payloadStart + 14, true);
    } else if (chunkId === 0x64617461) {
      // "data"
      dataOffset = payloadStart;
      dataByteLength = Math.min(chunkSize, wavBytes.byteLength - payloadStart);
      break;
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    if (paddedSize <= 0 && chunkSize === 0) {
      offset += 8;
    } else {
      offset = payloadStart + paddedSize;
    }
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || dataOffset < 0 || dataByteLength < 4) {
    return wavBytes;
  }

  const sampleCount = Math.floor(dataByteLength / 2);
  let peakAbs = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(dataOffset + i * 2, true);
    const abs = sample < 0 ? -sample : sample;
    if (abs > peakAbs) peakAbs = abs;
  }

  // Ignore near-silent buffers
  if (peakAbs < 320) return wavBytes;

  const rawGain = STUDIO_TARGET_PCM16_PEAK / peakAbs;
  const clampedGain = Math.max(0.65, Math.min(3.0, rawGain));
  if (Math.abs(clampedGain - 1.0) < 0.04) {
    return wavBytes;
  }

  const output = new Uint8Array(wavBytes.byteLength);
  output.set(wavBytes);
  const outView = new DataView(output.buffer, output.byteOffset, output.byteLength);

  for (let i = 0; i < sampleCount; i++) {
    const bytePos = dataOffset + i * 2;
    const scaled = Math.round(outView.getInt16(bytePos, true) * clampedGain);
    const safeSample = scaled > 32767 ? 32767 : scaled < -32768 ? -32768 : scaled;
    outView.setInt16(bytePos, safeSample, true);
  }

  return output;
}

export function normalizePcm16WavBase64(audioBase64: string, mimeType = 'audio/wav'): string {
  if (!audioBase64 || !mimeType.toLowerCase().includes('wav')) {
    return audioBase64;
  }
  try {
    const rawBytes = decodeBase64ToBytes(audioBase64);
    const normalizedBytes = normalizePcm16WavBytes(rawBytes);
    if (normalizedBytes === rawBytes) return audioBase64;
    return encodeBytesToBase64(normalizedBytes);
  } catch {
    return audioBase64;
  }
}

// ============================================================================
// 2. BUTTON VISUAL STATE HELPER (`idle` | `loading` | `playing`)
// ============================================================================

export interface AudioButtonMatchQuery {
  text: string;
  accent?: EnglishAccent;
  sourceId?: string;
  isComparing?: boolean;
  role?: PlaybackRole;
}

export function getAudioButtonVisualState(
  activeAudio: ActiveAudioPlayback | null,
  query: AudioButtonMatchQuery
): 'idle' | 'loading' | 'playing' {
  if (!activeAudio) return 'idle';

  if (query.role === 'recording') {
    if (activeAudio.role !== 'recording') return 'idle';
    if (query.sourceId && activeAudio.sourceId) {
      return activeAudio.sourceId === query.sourceId ? activeAudio.status : 'idle';
    }
    return activeAudio.text === query.text ? activeAudio.status : 'idle';
  }

  if (query.isComparing) {
    if (!activeAudio.isComparing) return 'idle';
    if (query.sourceId && activeAudio.sourceId) {
      return activeAudio.sourceId === query.sourceId ? activeAudio.status : 'idle';
    }
    const cleaned = sanitizeTextForSpeech(query.text);
    return cleaned && activeAudio.text === cleaned ? activeAudio.status : 'idle';
  }

  if (activeAudio.isComparing || activeAudio.role === 'recording') {
    return 'idle';
  }

  // When both the active session and the button specify a `sourceId`, match that exact button!
  if (query.sourceId && activeAudio.sourceId) {
    return activeAudio.sourceId === query.sourceId ? activeAudio.status : 'idle';
  }

  // Fallback match for keyboard shortcuts (`[U]`, `[B]`) or legacy callers without `sourceId`
  const cleaned = sanitizeTextForSpeech(query.text);
  if (!cleaned) return 'idle';
  if (query.accent && activeAudio.accent !== query.accent) return 'idle';
  return activeAudio.text === cleaned ? activeAudio.status : 'idle';
}

// ============================================================================
// 3. TWO-LEVEL PERSISTENT NEURAL AUDIO CACHE (MEMORY LRU + INDEXEDDB)
// ============================================================================

interface MemoryCachedTtsEntry {
  key: string;
  dataUrl: string;
  audioBase64: string;
  mimeType: string;
  voiceName: string;
  locale: 'en-US' | 'en-GB';
}

const memoryTtsCache = new Map<string, MemoryCachedTtsEntry>();
let idbPromise: Promise<IDBPDatabase | null> | null = null;
let customPersistentCacheAdapter: PersistentTtsCacheAdapter | null = null;

export function setCustomPersistentCacheAdapterForTests(
  adapter: PersistentTtsCacheAdapter | null
): void {
  customPersistentCacheAdapter = adapter;
}

export function clearMemoryAudioCacheForTests(): void {
  memoryTtsCache.clear();
}

export async function clearAllAudioCachesForTests(): Promise<void> {
  memoryTtsCache.clear();
  if (customPersistentCacheAdapter?.clear) {
    await customPersistentCacheAdapter.clear();
  }
}

function getMemoryCachedTts(key: string): MemoryCachedTtsEntry | null {
  const hit = memoryTtsCache.get(key);
  if (!hit) return null;
  memoryTtsCache.delete(key);
  memoryTtsCache.set(key, hit);
  return hit;
}

function putMemoryCachedTts(entry: MemoryCachedTtsEntry): void {
  if (memoryTtsCache.has(entry.key)) {
    memoryTtsCache.delete(entry.key);
  } else if (memoryTtsCache.size >= MAX_MEMORY_TTS_CACHE_ITEMS) {
    const oldestKey = memoryTtsCache.keys().next().value;
    if (oldestKey) memoryTtsCache.delete(oldestKey);
  }
  memoryTtsCache.set(entry.key, entry);
}

function openTtsCacheDb(): Promise<IDBPDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!idbPromise) {
    idbPromise = openDB(TTS_IDB_DATABASE_NAME, TTS_IDB_DATABASE_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TTS_IDB_STORE_NAME)) {
          const store = db.createObjectStore(TTS_IDB_STORE_NAME, { keyPath: 'key' });
          store.createIndex('by-updated', 'updatedAt');
        }
      },
    }).catch(() => {
      idbPromise = null;
      return null;
    });
  }
  return idbPromise;
}

async function readPersistentTtsCache(key: string): Promise<MemoryCachedTtsEntry | null> {
  if (customPersistentCacheAdapter) {
    try {
      const rec = await customPersistentCacheAdapter.get(key);
      if (!rec || !rec.audioBase64) return null;
      const entry: MemoryCachedTtsEntry = {
        key: rec.key,
        dataUrl: `data:${rec.mimeType || 'audio/wav'};base64,${rec.audioBase64}`,
        audioBase64: rec.audioBase64,
        mimeType: rec.mimeType || 'audio/wav',
        voiceName: rec.voiceName,
        locale: rec.locale,
      };
      putMemoryCachedTts(entry);
      return entry;
    } catch {
      return null;
    }
  }

  if (typeof indexedDB === 'undefined') return null;

  try {
    const db = await openTtsCacheDb();
    if (!db) return null;
    const rec = (await db.get(TTS_IDB_STORE_NAME, key)) as PersistedTtsCacheRecord | undefined;
    if (!rec || !rec.audioBase64) return null;

    const entry: MemoryCachedTtsEntry = {
      key: rec.key,
      dataUrl: `data:${rec.mimeType || 'audio/wav'};base64,${rec.audioBase64}`,
      audioBase64: rec.audioBase64,
      mimeType: rec.mimeType || 'audio/wav',
      voiceName: rec.voiceName,
      locale: rec.locale,
    };
    putMemoryCachedTts(entry);

    // Touch LRU timestamp asynchronously
    void db
      .put(TTS_IDB_STORE_NAME, { ...rec, updatedAt: Date.now() })
      .catch(() => {});

    return entry;
  } catch {
    return null;
  }
}

async function writePersistentTtsCache(record: PersistedTtsCacheRecord): Promise<void> {
  if (customPersistentCacheAdapter) {
    try {
      await customPersistentCacheAdapter.set(record);
    } catch {
      // ignore adapter write errors
    }
    return;
  }

  if (typeof indexedDB === 'undefined') return;

  try {
    const db = await openTtsCacheDb();
    if (!db) return;
    await db.put(TTS_IDB_STORE_NAME, record);

    const total = await db.count(TTS_IDB_STORE_NAME);
    if (total > MAX_IDB_TTS_CACHE_ITEMS) {
      const excess = total - MAX_IDB_TTS_CACHE_ITEMS;
      const tx = db.transaction(TTS_IDB_STORE_NAME, 'readwrite');
      const idx = tx.store.index('by-updated');
      let cursor = await idx.openCursor();
      let removed = 0;
      while (cursor && removed < excess) {
        await cursor.delete();
        removed++;
        cursor = await cursor.continue();
      }
      await tx.done;
    }
  } catch {
    // ignore IndexedDB quota/private-mode errors
  }
}

// ============================================================================
// 4. STRICTLY ISOLATED VOICE REGISTRIES & SELECTION HELPERS
// ============================================================================

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

const nativeVoiceIndexCache: {
  initialized: boolean;
  usIndex?: number;
  usName?: string;
  ukIndex?: number;
  ukName?: string;
} = {
  initialized: false,
};

const dictionaryHumanAudioCache = new Map<string, { usUrl?: string; ukUrl?: string }>();

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

export function isWebSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
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
        /google uk english male|\b(ryan|thomas|alfie|george|oliver|daniel|arthur)\b/i.test(
          v.name
        ) &&
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

function loadInitialSpeechSpeed(): SpeechSpeed {
  if (typeof window === 'undefined') return 'normal';
  try {
    const saved = window.localStorage?.getItem(SPEECH_SPEED_STORAGE_KEY);
    if (saved === 'slow' || saved === 'normal') return saved;
  } catch {
    // ignore storage errors
  }
  return 'normal';
}

function loadInitialVoiceLocale(): EnglishAccent {
  if (typeof window === 'undefined') return 'us';
  try {
    const saved = window.localStorage?.getItem(VOICE_LOCALE_STORAGE_KEY);
    if (saved === 'uk' || saved === 'us') return saved;
  } catch {
    // ignore storage errors
  }
  return 'us';
}

function resolveTtsApiEndpoint(): string | null {
  const configuredBase = (
    import.meta.env?.VITE_API_BASE_URL as string | undefined
  )?.replace(/\/+$/, '');
  if (Capacitor.isNativePlatform()) {
    return configuredBase ? `${configuredBase}/api/gemini/tts` : null;
  }
  return configuredBase ? `${configuredBase}/api/gemini/tts` : '/api/gemini/tts';
}

function canPlayHtmlAudio(): boolean {
  return typeof document !== 'undefined' || typeof Audio !== 'undefined';
}

// ============================================================================
// 5. GLOBAL DETERMINISTIC SINGLETON: `AudioPlaybackController` (STRICT MUTEX)
// ============================================================================

export class AudioPlaybackController {
  private currentPlaybackId = 0;
  private activeAbortController: AbortController | null = null;
  private reusableAudioEl: HTMLAudioElement | null = null;
  private reusableAudioDocRef: unknown = null;
  private sharedAudioContext: AudioContext | null = null;
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private activeGainNode: GainNode | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private readonly pendingCancelResolvers = new Set<() => void>();

  private currentPlayback: ActiveAudioPlayback | null = null;
  private currentSpeed: SpeechSpeed = loadInitialSpeechSpeed();
  private selectedVoiceLocale: EnglishAccent = loadInitialVoiceLocale();

  private readonly stateListeners = new Set<AudioStateListener>();
  private readonly speedListeners = new Set<SpeechSpeedListener>();
  private readonly localeListeners = new Set<VoiceLocaleListener>();
  private voicesChangedBound = false;

  constructor() {
    this.attachBrowserVoiceRegistryObserver();
    this.hydrateNativePreferencesAsync();
  }

  private attachBrowserVoiceRegistryObserver(): void {
    if (
      typeof window === 'undefined' ||
      Capacitor.isNativePlatform() ||
      !('speechSynthesis' in window)
    ) {
      return;
    }
    refreshIsolatedVoiceRegistries();
    if (this.voicesChangedBound) return;
    try {
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        // Registry refresh ONLY updates voice metadata; it NEVER calls speak()!
        window.speechSynthesis.addEventListener('voiceschanged', refreshIsolatedVoiceRegistries);
        this.voicesChangedBound = true;
      }
    } catch {
      // ignore legacy engine listener errors
    }
  }

  private hydrateNativePreferencesAsync(): void {
    if (typeof window === 'undefined') return;
    void Preferences.get({ key: SPEECH_SPEED_STORAGE_KEY })
      .then(({ value }) => {
        if ((value === 'slow' || value === 'normal') && value !== this.currentSpeed) {
          this.currentSpeed = value;
          this.notifySpeedListeners();
        }
      })
      .catch(() => {});

    void Preferences.get({ key: VOICE_LOCALE_STORAGE_KEY })
      .then(({ value }) => {
        if ((value === 'us' || value === 'uk') && value !== this.selectedVoiceLocale) {
          this.selectedVoiceLocale = value;
          this.notifyLocaleListeners();
        }
      })
      .catch(() => {});
  }

  public getCurrentPlaybackId(): number {
    return this.currentPlaybackId;
  }

  public getActivePlayback(): ActiveAudioPlayback | null {
    return this.currentPlayback;
  }

  public subscribe(listener: AudioStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.currentPlayback);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private setActivePlayback(next: ActiveAudioPlayback | null): void {
    this.currentPlayback = next;
    this.stateListeners.forEach((fn) => {
      try {
        fn(this.currentPlayback);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  private notifySpeedListeners(): void {
    this.speedListeners.forEach((fn) => {
      try {
        fn(this.currentSpeed);
      } catch {
        // ignore
      }
    });
  }

  private notifyLocaleListeners(): void {
    this.localeListeners.forEach((fn) => {
      try {
        fn(this.selectedVoiceLocale);
      } catch {
        // ignore
      }
    });
  }

  public getSelectedVoiceLocale(): EnglishAccent {
    return this.selectedVoiceLocale;
  }

  public switchVoiceLocale(
    nextAccent: EnglishAccent,
    options?: { preserveComparison?: boolean }
  ): void {
    if (nextAccent !== 'us' && nextAccent !== 'uk') return;
    const changed = this.selectedVoiceLocale !== nextAccent;
    this.selectedVoiceLocale = nextAccent;

    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(VOICE_LOCALE_STORAGE_KEY, nextAccent);
      } catch {
        // ignore storage errors
      }
      void Preferences.set({ key: VOICE_LOCALE_STORAGE_KEY, value: nextAccent }).catch(() => {});
    }

    if (
      changed &&
      !options?.preserveComparison &&
      this.currentPlayback &&
      this.currentPlayback.role !== 'recording' &&
      this.currentPlayback.accent !== nextAccent
    ) {
      this.stopAllAudio();
    }
    this.notifyLocaleListeners();
  }

  public subscribeVoiceLocale(listener: VoiceLocaleListener): () => void {
    this.localeListeners.add(listener);
    listener(this.selectedVoiceLocale);
    return () => {
      this.localeListeners.delete(listener);
    };
  }

  public getSpeechSpeed(): SpeechSpeed {
    return this.currentSpeed;
  }

  public setSpeechSpeed(next: SpeechSpeed): void {
    if (next !== 'normal' && next !== 'slow') return;
    this.currentSpeed = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(SPEECH_SPEED_STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      void Preferences.set({ key: SPEECH_SPEED_STORAGE_KEY, value: next }).catch(() => {});
    }
    this.notifySpeedListeners();
  }

  public toggleSpeechSpeed(): SpeechSpeed {
    const next: SpeechSpeed = this.currentSpeed === 'normal' ? 'slow' : 'normal';
    this.setSpeechSpeed(next);
    return next;
  }

  public subscribeSpeechSpeed(listener: SpeechSpeedListener): () => void {
    this.speedListeners.add(listener);
    listener(this.currentSpeed);
    return () => {
      this.speedListeners.delete(listener);
    };
  }

  /**
   * Returns the single reusable `HTMLAudioElement` instance for the current DOM context.
   */
  private getOrCreateReusableAudioElement(): HTMLAudioElement | null {
    const currentDoc = typeof document !== 'undefined' ? document : null;
    if (this.reusableAudioEl && this.reusableAudioDocRef === currentDoc) {
      return this.reusableAudioEl;
    }

    let el: HTMLAudioElement | null = null;
    if (currentDoc && typeof currentDoc.createElement === 'function') {
      el = currentDoc.createElement('audio');
    } else if (typeof Audio !== 'undefined') {
      el = new Audio();
    }

    if (el) {
      if (typeof el.setAttribute === 'function') {
        el.setAttribute('referrerpolicy', 'no-referrer');
      }
      el.preload = 'auto';
      this.reusableAudioEl = el;
      this.reusableAudioDocRef = currentDoc;
    }
    return el;
  }

  private resetReusableAudioElementSync(): void {
    const audio = this.reusableAudioEl;
    if (!audio) return;
    try {
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore uninitialized media currentTime setter errors
      }
      if (typeof audio.removeAttribute === 'function') {
        audio.removeAttribute('src');
      } else {
        audio.src = '';
      }
      if (typeof audio.load === 'function') {
        audio.load();
      }
    } catch {
      // ignore teardown errors
    }
  }

  private stopActiveWebAudioBufferSync(): void {
    if (this.activeBufferSource) {
      const src = this.activeBufferSource;
      this.activeBufferSource = null;
      try {
        src.onended = null;
        src.stop(0);
      } catch {
        // ignore if already stopped
      }
      try {
        src.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.activeGainNode) {
      const gain = this.activeGainNode;
      this.activeGainNode = null;
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    }
  }

  private flushPendingCancelResolversSync(): void {
    if (this.pendingCancelResolvers.size === 0) return;
    const callbacks = Array.from(this.pendingCancelResolvers);
    this.pendingCancelResolvers.clear();
    for (const cancel of callbacks) {
      try {
        cancel();
      } catch {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Synchronous millisecond-zero teardown of every active transport, fetch, buffer, and synth.
   */
  private haltAllTransportsSync(): void {
    if (Capacitor.isNativePlatform()) {
      void TextToSpeech.stop().catch(() => {});
    }

    if (this.activeAbortController) {
      const controller = this.activeAbortController;
      this.activeAbortController = null;
      try {
        controller.abort();
      } catch {
        // ignore abort errors
      }
    }

    this.flushPendingCancelResolversSync();
    this.stopActiveWebAudioBufferSync();
    this.resetReusableAudioElementSync();

    if (this.activeUtterance) {
      this.activeUtterance.onstart = null;
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }

    if (
      typeof window !== 'undefined' &&
      !Capacitor.isNativePlatform() &&
      'speechSynthesis' in window &&
      window.speechSynthesis
    ) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
      } catch {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Increments the monotonic `currentPlaybackId` and synchronously halts all audio at 0ms.
   */
  public stopAllAudio(): number {
    const nextId = ++this.currentPlaybackId;
    this.haltAllTransportsSync();
    this.setActivePlayback(null);
    return nextId;
  }

  /**
   * Atomically claims a new exclusive playback session (`++currentPlaybackId`) after 0ms teardown.
   */
  private beginExclusiveSession(): number {
    const myPlaybackId = ++this.currentPlaybackId;
    this.haltAllTransportsSync();
    return myPlaybackId;
  }

  public disposeForHmr(): void {
    this.stopAllAudio();
    if (
      this.voicesChangedBound &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.speechSynthesis?.removeEventListener === 'function'
    ) {
      try {
        window.speechSynthesis.removeEventListener(
          'voiceschanged',
          refreshIsolatedVoiceRegistries
        );
      } catch {
        // ignore
      }
      this.voicesChangedBound = false;
    }
    if (this.sharedAudioContext && this.sharedAudioContext.state !== 'closed') {
      void this.sharedAudioContext.close().catch(() => {});
      this.sharedAudioContext = null;
    }
  }

  private playOnReusableAudioElement(
    src: string,
    playbackRate: number,
    myPlaybackId: number,
    connectTimeoutMs: number,
    onPlaybackStarted?: () => void
  ): Promise<boolean> {
    if (myPlaybackId !== this.currentPlaybackId) {
      return Promise.resolve(false);
    }

    const audio = this.getOrCreateReusableAudioElement();
    if (!audio) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      if (myPlaybackId !== this.currentPlaybackId) {
        resolve(false);
        return;
      }

      let settled = false;
      let playStarted = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        this.pendingCancelResolvers.delete(onCancel);
        clearTimeout(connectTimer);
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (!ok && myPlaybackId === this.currentPlaybackId) {
          this.resetReusableAudioElementSync();
        }
        resolve(ok && myPlaybackId === this.currentPlaybackId);
      };

      const onCancel = () => finish(false);
      this.pendingCancelResolvers.add(onCancel);

      const connectTimer = setTimeout(() => {
        if (!playStarted) {
          finish(false);
        }
      }, connectTimeoutMs);

      const markStarted = () => {
        if (settled || myPlaybackId !== this.currentPlaybackId) {
          finish(false);
          return;
        }
        if (!playStarted) {
          playStarted = true;
          clearTimeout(connectTimer);
          onPlaybackStarted?.();
        }
      };

      audio.onplaying = markStarted;
      audio.onended = () => finish(true);
      audio.onerror = () => finish(playStarted);

      try {
        audio.volume = 1.0;
      } catch {
        // ignore read-only volume in mocks
      }
      audio.src = src;
      try {
        audio.playbackRate = playbackRate;
      } catch {
        // ignore
      }

      const playPromise = audio.play();
      if (playPromise !== undefined && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (!settled && myPlaybackId === this.currentPlaybackId && !playStarted) {
              // Ensure transition to `playing` even if a browser/mock resolves `play()` slightly before `onplaying`
              markStarted();
            }
          })
          .catch(() => {
            if (!playStarted) {
              finish(false);
            }
          });
      }
    });
  }

  /**
   * Primary Online Neural Engine (`/api/gemini/tts`) with 2-Level Persistent Cache (`Memory + IndexedDB`).
   * NEVER races with `window.speechSynthesis`.
   */
  private async playGeminiNeuralExclusive(params: {
    cleanedText: string;
    accent: EnglishAccent;
    speed: SpeechSpeed;
    role: PlaybackRole;
    sourceId?: string;
    myPlaybackId: number;
    isComparing: boolean;
    rateOverride?: number;
  }): Promise<boolean> {
    const {
      cleanedText,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    } = params;

    if (
      typeof window === 'undefined' ||
      typeof fetch !== 'function' ||
      !canPlayHtmlAudio() ||
      myPlaybackId !== this.currentPlaybackId
    ) {
      return false;
    }

    const effectivePlaybackRate =
      typeof rateOverride === 'number' && rateOverride > 0 ? rateOverride : 1.0;
    const pedagogicalRole: TtsPedagogicalRole | undefined =
      role === 'sentence' ? 'sentence' : role === 'term' ? 'term' : undefined;
    const directive = buildGeminiTtsDirective(cleanedText, accent, speed, pedagogicalRole);

    // Canonical cache key indexed by accent + Synthesis rate (`1.0` vs `0.7`) + normalized text
    const synthesisRateKey = normalizeTtsRateKey(speed);
    const cacheKey = buildTtsCacheKey(accent, synthesisRateKey, directive.normalizedText);

    // LEVEL 1: Synchronous 0ms Memory Cache
    let cached = getMemoryCachedTts(cacheKey);

    // LEVEL 2: Persistent IndexedDB Cache (survives F5 page reloads & offline sessions!)
    if (!cached) {
      cached = await readPersistentTtsCache(cacheKey);
      if (myPlaybackId !== this.currentPlaybackId) return false;
    }

    if (cached) {
      const voiceDisplay = `Gemini ${cached.voiceName} (${directive.languageCode})`;
      this.setActivePlayback({
        playbackId: myPlaybackId,
        status: 'playing',
        text: cleanedText,
        accent,
        locale: directive.languageCode,
        speed,
        role,
        sourceId,
        isComparing,
        engine: 'gemini-tts',
        voiceName: voiceDisplay,
      });
      return this.playOnReusableAudioElement(
        cached.dataUrl,
        effectivePlaybackRate,
        myPlaybackId,
        2500
      );
    }

    // Offline cache miss -> cleanly skip network fetch so contingency engine handles it
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    const endpoint = resolveTtsApiEndpoint();
    if (!endpoint) return false;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this.activeAbortController = controller;

    // Emit immediate `loading` state on cold start so ONLY the clicked button displays a spinner/pulse
    this.setActivePlayback({
      playbackId: myPlaybackId,
      status: 'loading',
      text: cleanedText,
      accent,
      locale: directive.languageCode,
      speed,
      role,
      sourceId,
      isComparing,
      engine: 'gemini-tts',
      voiceName: `Gemini ${directive.voiceName} (${directive.languageCode})`,
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedText,
          accent,
          speed,
          ...(pedagogicalRole ? { role: pedagogicalRole } : {}),
        }),
        signal: controller?.signal,
      });

      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }

      if (
        myPlaybackId !== this.currentPlaybackId ||
        controller?.signal.aborted ||
        !response.ok
      ) {
        return false;
      }

      const payload = (await response.json()) as {
        success?: boolean;
        audioBase64?: string;
        mimeType?: string;
        voiceName?: string;
      };

      if (
        myPlaybackId !== this.currentPlaybackId ||
        controller?.signal.aborted ||
        !payload?.success ||
        !payload.audioBase64
      ) {
        return false;
      }

      const mimeType = payload.mimeType || 'audio/wav';
      const normalizedBase64 = normalizePcm16WavBase64(payload.audioBase64, mimeType);
      const dataUrl = `data:${mimeType};base64,${normalizedBase64}`;
      const voiceLabel = payload.voiceName || directive.voiceName;

      const memEntry: MemoryCachedTtsEntry = {
        key: cacheKey,
        dataUrl,
        audioBase64: normalizedBase64,
        mimeType,
        voiceName: voiceLabel,
        locale: directive.languageCode,
      };
      putMemoryCachedTts(memEntry);
      void writePersistentTtsCache({
        key: cacheKey,
        audioBase64: normalizedBase64,
        mimeType,
        voiceName: voiceLabel,
        locale: directive.languageCode,
        updatedAt: Date.now(),
      });

      if (myPlaybackId !== this.currentPlaybackId) return false;

      const transitionToPlaying = () => {
        if (myPlaybackId !== this.currentPlaybackId) return;
        this.setActivePlayback({
          playbackId: myPlaybackId,
          status: 'playing',
          text: cleanedText,
          accent,
          locale: directive.languageCode,
          speed,
          role,
          sourceId,
          isComparing,
          engine: 'gemini-tts',
          voiceName: `Gemini ${voiceLabel} (${directive.languageCode})`,
        });
      };

      return await this.playOnReusableAudioElement(
        dataUrl,
        effectivePlaybackRate,
        myPlaybackId,
        3500,
        transitionToPlaying
      );
    } catch {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
      return false;
    }
  }

  private async ensureVoicesReady(
    maxWaitMs: number,
    myPlaybackId: number
  ): Promise<SpeechSynthesisVoice[]> {
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
        this.pendingCancelResolvers.delete(onCancel);
        clearTimeout(timer);
        try {
          if (typeof window.speechSynthesis.removeEventListener === 'function') {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
          }
        } catch {
          // ignore
        }
        if (myPlaybackId === this.currentPlaybackId) {
          refreshIsolatedVoiceRegistries();
          resolve(window.speechSynthesis.getVoices() || []);
        } else {
          resolve([]);
        }
      };
      const onVoices = () => finish();
      const onCancel = () => finish();
      this.pendingCancelResolvers.add(onCancel);

      try {
        if (typeof window.speechSynthesis.addEventListener === 'function') {
          window.speechSynthesis.addEventListener('voiceschanged', onVoices, { once: true });
        }
      } catch {
        // ignore
      }
      const timer = setTimeout(finish, maxWaitMs);
    });
  }

  /**
   * Strict Offline / Neural-Failure Contingency via Web Speech API.
   * NOTE: Never armed concurrently with `/api/gemini/tts`, and never falls through on a short 450ms timer!
   */
  private async playWebSpeechContingency(params: {
    cleanedText: string;
    accent: EnglishAccent;
    speed: SpeechSpeed;
    role: PlaybackRole;
    sourceId?: string;
    myPlaybackId: number;
    isComparing: boolean;
    rateOverride?: number;
  }): Promise<boolean> {
    const {
      cleanedText,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    } = params;

    if (!isWebSpeechSupported() || myPlaybackId !== this.currentPlaybackId) {
      return false;
    }

    await this.ensureVoicesReady(220, myPlaybackId);
    if (myPlaybackId !== this.currentPlaybackId) return false;

    const profile = LOCALE_SPEECH_PROFILES[accent];
    const matchedVoice =
      accent === 'uk' ? ukVoiceRegistry.selectedVoice : usVoiceRegistry.selectedVoice;
    const hasVerifiedLocaleVoice =
      matchedVoice !== null && normalizeVoiceLangTag(matchedVoice.lang) === profile.bcp47;

    if (!hasVerifiedLocaleVoice || !matchedVoice) {
      return false;
    }

    const tuning = computeUtteranceTuning(accent, speed);
    const effectiveRate =
      typeof rateOverride === 'number' && rateOverride > 0 ? rateOverride : tuning.rate;
    const spokenText =
      accent === 'uk' ? prepareBritishWebSpeechText(cleanedText) : cleanedText;

    const _ssml = accent === 'uk' ? buildBritishRpSsml(cleanedText, speed) : undefined;
    void _ssml;

    this.setActivePlayback({
      playbackId: myPlaybackId,
      status: 'playing',
      text: cleanedText,
      accent,
      locale: tuning.lang,
      speed,
      role,
      sourceId,
      isComparing,
      engine: 'web-speech',
      voiceName: matchedVoice.name,
    });

    return new Promise<boolean>((resolve) => {
      if (myPlaybackId !== this.currentPlaybackId) {
        resolve(false);
        return;
      }

      try {
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
        utter.volume = 1.0;

        let settled = false;
        let safetyTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          this.pendingCancelResolvers.delete(onCancel);
          if (safetyTimer !== null) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
          }
          utter.onstart = null;
          utter.onend = null;
          utter.onerror = null;
          if (this.activeUtterance === utter) {
            this.activeUtterance = null;
          }
          resolve(ok && myPlaybackId === this.currentPlaybackId);
        };

        const onCancel = () => finish(false);
        this.pendingCancelResolvers.add(onCancel);

        utter.onstart = () => {
          if (myPlaybackId !== this.currentPlaybackId) {
            try {
              window.speechSynthesis.cancel();
            } catch {
              // ignore
            }
            finish(false);
          }
        };

        utter.onend = () => finish(true);
        utter.onerror = () => finish(false);

        this.activeUtterance = utter;

        const maxDuration = estimateSpeechSafetyTimeoutMs(spokenText, effectiveRate);
        safetyTimer = setTimeout(() => {
          finish(true);
        }, maxDuration);

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utter);
      } catch {
        resolve(false);
      }
    });
  }

  private async resolveNativeMobileVoiceIndices(): Promise<void> {
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
      // Safe to ignore on OS engines that do not enumerate voice indices
    }
  }

  private async playNativeMobileTTS(params: {
    cleanedText: string;
    accent: EnglishAccent;
    speed: SpeechSpeed;
    role: PlaybackRole;
    sourceId?: string;
    myPlaybackId: number;
    isComparing: boolean;
    rateOverride?: number;
  }): Promise<boolean> {
    const {
      cleanedText,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    } = params;

    if (!Capacitor.isNativePlatform() || myPlaybackId !== this.currentPlaybackId) {
      return false;
    }

    const strictLocale: 'en-US' | 'en-GB' = accent === 'uk' ? 'en-GB' : 'en-US';
    const spokenText =
      accent === 'uk' ? prepareBritishWebSpeechText(cleanedText) : cleanedText;
    const rate =
      typeof rateOverride === 'number' && rateOverride > 0
        ? rateOverride
        : speed === 'slow'
        ? 0.72
        : 0.96;
    const pitch = accent === 'uk' ? 0.98 : 1.0;

    await this.resolveNativeMobileVoiceIndices();
    if (myPlaybackId !== this.currentPlaybackId) return false;

    const voiceIndex =
      accent === 'uk' ? nativeVoiceIndexCache.ukIndex : nativeVoiceIndexCache.usIndex;
    const voiceLabel =
      accent === 'uk'
        ? nativeVoiceIndexCache.ukName || 'Native UK (en-GB)'
        : nativeVoiceIndexCache.usName || 'Native US (en-US)';

    this.setActivePlayback({
      playbackId: myPlaybackId,
      status: 'playing',
      text: cleanedText,
      accent,
      locale: strictLocale,
      speed,
      role,
      sourceId,
      isComparing,
      engine: 'native-tts',
      voiceName: voiceLabel,
    });

    try {
      await TextToSpeech.stop().catch(() => {});
      if (myPlaybackId !== this.currentPlaybackId) return false;

      let cancelled = false;
      const onCancel = () => {
        cancelled = true;
        void TextToSpeech.stop().catch(() => {});
      };
      this.pendingCancelResolvers.add(onCancel);

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
        return !cancelled && myPlaybackId === this.currentPlaybackId;
      } finally {
        this.pendingCancelResolvers.delete(onCancel);
      }
    } catch {
      return false;
    }
  }

  private async playCloudNativeContingency(params: {
    cleanedText: string;
    accent: EnglishAccent;
    speed: SpeechSpeed;
    role: PlaybackRole;
    sourceId?: string;
    myPlaybackId: number;
    isComparing: boolean;
    rateOverride?: number;
  }): Promise<boolean> {
    const {
      cleanedText,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    } = params;

    if (
      !canPlayHtmlAudio() ||
      myPlaybackId !== this.currentPlaybackId ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      return false;
    }

    const profile = LOCALE_SPEECH_PROFILES[accent];
    const urls = buildNativeCloudAudioUrls(cleanedText, accent);
    const rate =
      typeof rateOverride === 'number' && rateOverride > 0
        ? rateOverride
        : speed === 'slow'
        ? 0.72
        : 1.0;

    for (const url of urls) {
      if (myPlaybackId !== this.currentPlaybackId) return false;
      const ok = await this.playOnReusableAudioElement(url, rate, myPlaybackId, 1800, () => {
        if (myPlaybackId !== this.currentPlaybackId) return;
        this.setActivePlayback({
          playbackId: myPlaybackId,
          status: 'playing',
          text: cleanedText,
          accent,
          locale: profile.bcp47,
          speed,
          role,
          sourceId,
          isComparing,
          engine: 'cloud-fallback',
        });
      });
      if (ok) return true;
    }
    return false;
  }

  private waitWithCancel(ms: number, myPlaybackId: number): Promise<boolean> {
    if (ms <= 0 || myPlaybackId !== this.currentPlaybackId) {
      return Promise.resolve(myPlaybackId === this.currentPlaybackId);
    }
    return new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        this.pendingCancelResolvers.delete(onCancel);
        clearTimeout(timer);
        resolve(ok && myPlaybackId === this.currentPlaybackId);
      };
      const onCancel = () => finish(false);
      const timer = setTimeout(() => finish(myPlaybackId === this.currentPlaybackId), ms);
      this.pendingCancelResolvers.add(onCancel);
    });
  }

  private async speakSingleSegmentExclusive(params: {
    cleaned: string;
    accent: EnglishAccent;
    speed: SpeechSpeed;
    role: PlaybackRole;
    sourceId?: string;
    myPlaybackId: number;
    isComparing: boolean;
    rateOverride?: number;
  }): Promise<boolean> {
    const {
      cleaned,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    } = params;

    if (!cleaned || typeof window === 'undefined' || myPlaybackId !== this.currentPlaybackId) {
      return false;
    }

    // PATH A: Native Mobile Platform (Android / iOS)
    if (Capacitor.isNativePlatform()) {
      const neuralOk = await this.playGeminiNeuralExclusive({
        cleanedText: cleaned,
        accent,
        speed,
        role,
        sourceId,
        myPlaybackId,
        isComparing,
        rateOverride,
      });
      if (myPlaybackId !== this.currentPlaybackId) return false;
      if (neuralOk) return true;

      const nativeOk = await this.playNativeMobileTTS({
        cleanedText: cleaned,
        accent,
        speed,
        role,
        sourceId,
        myPlaybackId,
        isComparing,
        rateOverride,
      });
      if (myPlaybackId !== this.currentPlaybackId) return false;
      if (nativeOk) return true;

      return this.playCloudNativeContingency({
        cleanedText: cleaned,
        accent,
        speed,
        role,
        sourceId,
        myPlaybackId,
        isComparing,
        rateOverride,
      });
    }

    // PATH B: Web / Desktop Platform — Exclusive Neural-First Hierarchy (Cache -> `/api/gemini/tts`)
    const neuralOk = await this.playGeminiNeuralExclusive({
      cleanedText: cleaned,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    });
    if (myPlaybackId !== this.currentPlaybackId) return false;
    if (neuralOk) return true;

    // Guarantee any aborted/failed neural transport is 100% cleared before contingency runs
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {
        // ignore
      }
      this.activeAbortController = null;
    }
    this.resetReusableAudioElementSync();
    if (myPlaybackId !== this.currentPlaybackId) return false;

    // STRICT CONTINGENCY ONLY (Offline or definitive `/api/gemini/tts` failure)
    const webSpeechOk = await this.playWebSpeechContingency({
      cleanedText: cleaned,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    });
    if (myPlaybackId !== this.currentPlaybackId) return false;
    if (webSpeechOk) return true;

    return this.playCloudNativeContingency({
      cleanedText: cleaned,
      accent,
      speed,
      role,
      sourceId,
      myPlaybackId,
      isComparing,
      rateOverride,
    });
  }

  public async speak(
    text: string,
    accent: EnglishAccent = 'us',
    options?: SpeakOptions
  ): Promise<boolean> {
    const cleaned = sanitizeTextForSpeech(text);
    if (!cleaned || typeof window === 'undefined') return false;

    this.switchVoiceLocale(accent, { preserveComparison: Boolean(options?.isComparing) });
    const myPlaybackId = this.beginExclusiveSession();

    const speed = options?.speed ?? this.currentSpeed;
    const isComparing = Boolean(options?.isComparing);
    const role: PlaybackRole = isComparing
      ? 'comparison'
      : options?.role === 'sentence'
      ? 'sentence'
      : options?.role === 'term'
      ? 'term'
      : cleaned.split(/\s+/).length >= 5 || /[.!?]$/.test(cleaned)
      ? 'sentence'
      : 'term';

    const ok = await this.speakSingleSegmentExclusive({
      cleaned,
      accent,
      speed,
      role,
      sourceId: options?.sourceId,
      myPlaybackId,
      isComparing,
      rateOverride: options?.rateOverride,
    });

    if (myPlaybackId === this.currentPlaybackId) {
      this.setActivePlayback(null);
    }
    return ok;
  }

  public async toggleSpeak(
    text: string,
    accent: EnglishAccent = 'us',
    options?: SpeakOptions
  ): Promise<boolean> {
    const cleaned = sanitizeTextForSpeech(text);
    if (!cleaned || typeof window === 'undefined') return false;

    const active = this.currentPlayback;
    if (active && !active.isComparing && active.role !== 'recording') {
      const sameSource =
        options?.sourceId && active.sourceId
          ? active.sourceId === options.sourceId
          : active.accent === accent && active.text === cleaned;
      if (sameSource) {
        this.stopAllAudio();
        return false;
      }
    }

    return this.speak(cleaned, accent, options);
  }

  public async compareUsAndUk(
    usText: string,
    ukText?: string,
    options?: SpeakOptions
  ): Promise<boolean> {
    const cleanUs = sanitizeTextForSpeech(usText);
    const cleanUk = sanitizeTextForSpeech(ukText || usText);
    if (!cleanUs || typeof window === 'undefined') return false;

    const active = this.currentPlayback;
    if (
      active?.isComparing &&
      (options?.sourceId && active.sourceId
        ? active.sourceId === options.sourceId
        : active.text === cleanUs || active.text === cleanUk)
    ) {
      this.stopAllAudio();
      return false;
    }

    const myPlaybackId = this.beginExclusiveSession();
    const speed = options?.speed ?? this.currentSpeed;

    this.switchVoiceLocale('us', { preserveComparison: true });
    await this.speakSingleSegmentExclusive({
      cleaned: cleanUs,
      accent: 'us',
      speed,
      role: 'comparison',
      sourceId: options?.sourceId,
      myPlaybackId,
      isComparing: true,
    });
    if (myPlaybackId !== this.currentPlaybackId) return false;

    const delayOk = await this.waitWithCancel(300, myPlaybackId);
    if (!delayOk || myPlaybackId !== this.currentPlaybackId) return false;

    this.switchVoiceLocale('uk', { preserveComparison: true });
    const okUk = await this.speakSingleSegmentExclusive({
      cleaned: cleanUk,
      accent: 'uk',
      speed,
      role: 'comparison',
      sourceId: options?.sourceId,
      myPlaybackId,
      isComparing: true,
    });
    if (myPlaybackId === this.currentPlaybackId) {
      this.setActivePlayback(null);
    }
    return okUk;
  }

  private getOrCreateSharedAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.sharedAudioContext && this.sharedAudioContext.state !== 'closed') {
      return this.sharedAudioContext;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      this.sharedAudioContext = new AudioCtx();
      return this.sharedAudioContext;
    } catch {
      return null;
    }
  }

  /**
   * Plays student voice recording (`▶️ Minha Voz`) under the exact same global `currentPlaybackId` mutex,
   * normalizing microphone capture gain to match studio native TTS loudness.
   */
  public async playRecordedBlob(
    blobUrl: string,
    options?: PlayRecordedBlobOptions
  ): Promise<boolean> {
    if (!blobUrl || typeof window === 'undefined') return false;

    const myPlaybackId = this.beginExclusiveSession();
    const accent: EnglishAccent = options?.accent ?? this.selectedVoiceLocale;
    const locale: 'en-US' | 'en-GB' = accent === 'uk' ? 'en-GB' : 'en-US';
    const sourceId = options?.sourceId ?? 'student-own-recording';

    this.setActivePlayback({
      playbackId: myPlaybackId,
      status: 'loading',
      text: blobUrl,
      accent,
      locale,
      role: 'recording',
      sourceId,
      engine: 'recorded-blob',
      voiceName: 'Minha Voz',
    });

    // Try Web Audio API decode + peak gain normalization first for consistent studio volume
    const ctx = this.getOrCreateSharedAudioContext();
    if (ctx && (options?.blob || typeof fetch === 'function')) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        if (myPlaybackId !== this.currentPlaybackId) return false;

        const rawBuffer = options?.blob
          ? await options.blob.arrayBuffer()
          : await (await fetch(blobUrl)).arrayBuffer();
        if (myPlaybackId !== this.currentPlaybackId) return false;

        const audioBuffer = await ctx.decodeAudioData(rawBuffer.slice(0));
        if (myPlaybackId !== this.currentPlaybackId) return false;

        let peak = 0;
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const data = audioBuffer.getChannelData(ch);
          for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
          }
        }
        const targetGain =
          peak > 0.01 ? Math.max(0.75, Math.min(2.8, STUDIO_TARGET_FLOAT_PEAK / peak)) : 1.0;

        const playedViaWebAudio = await new Promise<boolean>((resolve) => {
          if (myPlaybackId !== this.currentPlaybackId) {
            resolve(false);
            return;
          }

          const sourceNode = ctx.createBufferSource();
          const gainNode = ctx.createGain();
          sourceNode.buffer = audioBuffer;
          gainNode.gain.value = targetGain;

          sourceNode.connect(gainNode);
          gainNode.connect(ctx.destination);

          this.activeBufferSource = sourceNode;
          this.activeGainNode = gainNode;

          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            this.pendingCancelResolvers.delete(onCancel);
            sourceNode.onended = null;
            if (this.activeBufferSource === sourceNode) {
              this.activeBufferSource = null;
            }
            if (this.activeGainNode === gainNode) {
              this.activeGainNode = null;
            }
            try {
              sourceNode.disconnect();
              gainNode.disconnect();
            } catch {
              // ignore
            }
            resolve(ok && myPlaybackId === this.currentPlaybackId);
          };

          const onCancel = () => finish(false);
          this.pendingCancelResolvers.add(onCancel);

          sourceNode.onended = () => finish(true);

          this.setActivePlayback({
            playbackId: myPlaybackId,
            status: 'playing',
            text: blobUrl,
            accent,
            locale,
            role: 'recording',
            sourceId,
            engine: 'recorded-blob',
            voiceName: 'Minha Voz',
          });

          sourceNode.start(0);
        });

        if (myPlaybackId === this.currentPlaybackId) {
          this.setActivePlayback(null);
        }
        return playedViaWebAudio;
      } catch {
        // Fall through cleanly to singleton HTMLAudioElement if codec isn't decoded by AudioContext
        if (myPlaybackId !== this.currentPlaybackId) return false;
      }
    }

    const ok = await this.playOnReusableAudioElement(blobUrl, 1.0, myPlaybackId, 3000, () => {
      if (myPlaybackId !== this.currentPlaybackId) return;
      this.setActivePlayback({
        playbackId: myPlaybackId,
        status: 'playing',
        text: blobUrl,
        accent,
        locale,
        role: 'recording',
        sourceId,
        engine: 'recorded-blob',
        voiceName: 'Minha Voz',
      });
    });

    if (myPlaybackId === this.currentPlaybackId) {
      this.setActivePlayback(null);
    }
    return ok;
  }

  public async toggleRecordedBlob(
    blobUrl: string,
    options?: PlayRecordedBlobOptions
  ): Promise<boolean> {
    if (!blobUrl || typeof window === 'undefined') return false;
    const sourceId = options?.sourceId ?? 'student-own-recording';
    const active = this.currentPlayback;
    if (
      active?.role === 'recording' &&
      (active.sourceId === sourceId || active.text === blobUrl)
    ) {
      this.stopAllAudio();
      return false;
    }
    return this.playRecordedBlob(blobUrl, options);
  }
}

export const audioPlaybackController = new AudioPlaybackController();

// Vite HMR cleanup: guarantee zero leaked listeners or orphaned playback across module reloads
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    audioPlaybackController.disposeForHmr();
  });
}
