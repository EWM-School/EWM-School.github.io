import type { EnglishAccent } from '../../types/flashcard';
import {
  audioPlaybackController,
  type ActiveAudioPlayback,
  type PlayRecordedBlobOptions,
  type SpeakOptions,
  type SpeechSpeed,
} from './audioPlaybackController';

export {
  AudioPlaybackController,
  audioPlaybackController,
  buildNativeCloudAudioUrls,
  buildTtsCacheKey,
  cleanEnglishForSpeech,
  clearAllAudioCachesForTests,
  clearMemoryAudioCacheForTests,
  computeUtteranceTuning,
  estimateSpeechSafetyTimeoutMs,
  getAudioButtonVisualState,
  isNonEnglishOrPortugueseVoice,
  isWebSpeechSupported,
  normalizePcm16WavBase64,
  normalizePcm16WavBytes,
  normalizeTtsRateKey,
  pickAmericanEnglishVoice,
  pickBritishEnglishVoice,
  pickNativeEnglishVoice,
  registerDictionaryAudioUrls,
  sanitizeTextForSpeech,
  selectBestEnglishVoice,
  setCustomPersistentCacheAdapterForTests,
  type ActiveAudioPlayback,
  type AudioButtonMatchQuery,
  type AudioEngineSource,
  type AudioPlaybackStatus,
  type PersistedTtsCacheRecord,
  type PersistentTtsCacheAdapter,
  type PlayRecordedBlobOptions,
  type PlaybackRole,
  type SpeakOptions,
  type SpeechSpeed,
  type VoiceDescriptor,
} from './audioPlaybackController';

type AudioStateListener = (active: ActiveAudioPlayback | null) => void;
type SpeechSpeedListener = (speed: SpeechSpeed) => void;
type VoiceLocaleListener = (accent: EnglishAccent) => void;

export function subscribeAudioPlayback(listener: AudioStateListener): () => void {
  return audioPlaybackController.subscribe(listener);
}

export function getActiveAudioPlayback(): ActiveAudioPlayback | null {
  return audioPlaybackController.getActivePlayback();
}

export function getSelectedVoiceLocale(): EnglishAccent {
  return audioPlaybackController.getSelectedVoiceLocale();
}

export function switchVoiceLocale(
  nextAccent: EnglishAccent,
  options?: { preserveComparison?: boolean }
): void {
  audioPlaybackController.switchVoiceLocale(nextAccent, options);
}

export function subscribeVoiceLocale(listener: VoiceLocaleListener): () => void {
  return audioPlaybackController.subscribeVoiceLocale(listener);
}

export function getSpeechSpeed(): SpeechSpeed {
  return audioPlaybackController.getSpeechSpeed();
}

export function setSpeechSpeed(next: SpeechSpeed): void {
  audioPlaybackController.setSpeechSpeed(next);
}

export function toggleSpeechSpeed(): SpeechSpeed {
  return audioPlaybackController.toggleSpeechSpeed();
}

export function subscribeSpeechSpeed(listener: SpeechSpeedListener): () => void {
  return audioPlaybackController.subscribeSpeechSpeed(listener);
}

/**
 * Synchronously aborts all in-flight TTS fetches, Web Audio buffers, HTMLAudioElement streams,
 * and SpeechSynthesis utterances at millisecond zero via the global singleton mutex.
 */
export function stopCurrentAudio(): void {
  audioPlaybackController.stopAllAudio();
}

export async function speakEnglishText(
  text: string,
  accent: EnglishAccent = 'us',
  options?: SpeakOptions
): Promise<boolean> {
  return audioPlaybackController.speak(text, accent, options);
}

export async function toggleSpeakEnglishText(
  text: string,
  accent: EnglishAccent = 'us',
  options?: SpeakOptions
): Promise<boolean> {
  return audioPlaybackController.toggleSpeak(text, accent, options);
}

export async function compareUsAndUkSpeech(
  usText: string,
  ukText?: string,
  options?: SpeakOptions
): Promise<boolean> {
  return audioPlaybackController.compareUsAndUk(usText, ukText, options);
}

export async function playRecordedBlobAudio(
  blobUrl: string,
  options?: PlayRecordedBlobOptions
): Promise<boolean> {
  return audioPlaybackController.playRecordedBlob(blobUrl, options);
}

export async function toggleRecordedBlobAudio(
  blobUrl: string,
  options?: PlayRecordedBlobOptions
): Promise<boolean> {
  return audioPlaybackController.toggleRecordedBlob(blobUrl, options);
}

// ============================================================================
// VOICE SEARCH (SPEECH RECOGNITION ADAPTER)
// ============================================================================

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
