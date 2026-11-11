import type { EnglishAccent } from '../types/flashcard';

export interface ActiveAudioPlayback {
  text: string;
  accent: EnglishAccent;
}

type AudioStateListener = (active: ActiveAudioPlayback | null) => void;

let activeAudioElement: HTMLAudioElement | null = null;
let cachedUsVoice: SpeechSynthesisVoice | null = null;
let cachedUkVoice: SpeechSynthesisVoice | null = null;
let currentPlayback: ActiveAudioPlayback | null = null;

const listeners = new Set<AudioStateListener>();
const dictionaryHumanAudioCache = new Map<string, { usUrl?: string; ukUrl?: string }>();

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

export function subscribeAudioPlayback(listener: AudioStateListener): () => void {
  listeners.add(listener);
  listener(currentPlayback);
  return () => {
    listeners.delete(listener);
  };
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

function isNonEnglishOrPortugueseVoice(voice: SpeechSynthesisVoice | null | undefined): boolean {
  if (!voice) return true;
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
 * Picks a strictly verified native English Web Speech voice matching the requested accent.
 * Never returns a Portuguese voice, and prioritizes exact regional voices (`en-US` vs `en-GB`).
 */
export function pickNativeEnglishVoice(accent: EnglishAccent): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const englishVoices = voices.filter((v) => !isNonEnglishOrPortugueseVoice(v));
  if (englishVoices.length === 0) return null;

  if (accent === 'uk') {
    // 1. Strictly prioritize verified native British MALE voices across all OS & browsers:
    // (Google UK English Male, Microsoft Ryan/George, Apple Daniel/Oliver/Arthur/Thomas, Brian)
    const preferredUkMale = [
      (v: SpeechSynthesisVoice) =>
        /^en[-_]?gb$/i.test(v.lang) &&
        /male|ryan|george|oliver|daniel|arthur|thomas|brian|william|alfie|harry|charles|edward|guy/i.test(v.name) &&
        !/female|sonia|libby|maisie|serena|martha|kate|hazel|victoria|alice|mia|stephanie|susan|fiona|amy/i.test(v.name),
      (v: SpeechSynthesisVoice) =>
        /uk|british|great britain/i.test(v.name) &&
        /male|ryan|george|oliver|daniel|arthur|thomas|brian/i.test(v.name) &&
        !/female|sonia|libby|maisie|serena|martha|kate|hazel/i.test(v.name),
      // Any en-GB voice that does not have female names
      (v: SpeechSynthesisVoice) =>
        /^en[-_]?gb$/i.test(v.lang) &&
        !/female|sonia|libby|maisie|serena|martha|kate|hazel|victoria|alice|mia|stephanie|susan|fiona|amy/i.test(v.name),
      (v: SpeechSynthesisVoice) => /^en[-_]?gb$/i.test(v.lang),
    ];

    for (const check of preferredUkMale) {
      const match = englishVoices.find(check);
      if (match) {
        cachedUkVoice = match;
        return match;
      }
    }
    return null;
  }

  const preferredUs = [
    (v: SpeechSynthesisVoice) =>
      /^en[-_]?us$/i.test(v.lang) && /natural|google us|samantha|aria|jenny|ava|allison/i.test(v.name),
    (v: SpeechSynthesisVoice) =>
      /^en[-_]?us$/i.test(v.lang) && /microsoft|apple|zira|samantha/i.test(v.name),
    (v: SpeechSynthesisVoice) => /^en[-_]?us$/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /^en[-_]?ca$/i.test(v.lang),
    (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('en'),
  ];

  for (const check of preferredUs) {
    const match = englishVoices.find(check);
    if (match) {
      cachedUsVoice = match;
      return match;
    }
  }
  return englishVoices[0] || null;
}

export function pickAmericanEnglishVoice(): SpeechSynthesisVoice | null {
  return pickNativeEnglishVoice('us');
}

export function pickBritishEnglishVoice(): SpeechSynthesisVoice | null {
  return pickNativeEnglishVoice('uk');
}

/**
 * Cleans English text for TTS while strictly preserving internal apostrophes in contractions
 * (so "I'll" is never mangled into "Ill" and "we're" is never mangled into "were"!).
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

/**
 * Builds the prioritized list of native cloud TTS URLs for the exact requested accent (`us` vs `uk`).
 * - `tl=en-US` / Youdao `type=2` for General American English
 * - `tl=en-GB` / Youdao `type=1` for British English (Received Pronunciation / Modern Southern British)
 */
export function buildNativeCloudAudioUrls(cleanedText: string, accent: EnglishAccent): string[] {
  const urls: string[] = [];
  const lowerSingleWord = cleanedText.toLowerCase().replace(/[.!?,;:]+$/g, '').trim();

  // Optional verified human dictionary studio recording if already cached for this exact single word
  if (!/\s/.test(lowerSingleWord)) {
    const humanCached = dictionaryHumanAudioCache.get(lowerSingleWord);
    const humanUrl = accent === 'uk' ? humanCached?.ukUrl : humanCached?.usUrl;
    if (humanUrl) {
      urls.push(humanUrl);
    }
  }

  const tl = accent === 'uk' ? 'en-GB' : 'en-US';
  const q = encodeURIComponent(cleanedText);
  const youdaoSafe = cleanedText.replace(/[?!;:]+/g, '').trim();

  // For British English (UK), prioritize the native British Male studio voice (type=1)
  if (accent === 'uk') {
    if (youdaoSafe && youdaoSafe.length <= 140) {
      urls.push(
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(youdaoSafe)}&type=1`
      );
    }
  }

  // Google TTS streams
  urls.push(`https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${tl}&dt=t&q=${q}`);
  urls.push(`https://translate.googleapis.com/translate_tts?client=tw-ob&ie=UTF-8&tl=${tl}&q=${q}`);

  if (accent !== 'uk') {
    if (youdaoSafe && youdaoSafe.length <= 140) {
      urls.push(
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(youdaoSafe)}&type=2`
      );
    }
  }

  return urls;
}

export function stopCurrentAudio(): void {
  if (activeAudioElement) {
    try {
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.src = '';
    } catch {
      // ignore cleanup errors
    }
    activeAudioElement = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
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

function playCloudNativeTTS(cleanedText: string, accent: EnglishAccent): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const urls = buildNativeCloudAudioUrls(cleanedText, accent);
    let index = 0;

    function tryNextUrl() {
      if (index >= urls.length) {
        reject(new Error('All native cloud TTS streams failed'));
        return;
      }
      const url = urls[index++];
      const audio = document.createElement('audio');
      audio.setAttribute('referrerpolicy', 'no-referrer');
      audio.preload = 'auto';
      activeAudioElement = audio;

      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            audio.pause();
          } catch {
            // ignore
          }
          tryNextUrl();
        }
      }, 1800); // 1.8s timeout to ensure mobile touch gesture window does not expire

      audio.onplaying = () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(true);
        }
      };

      audio.onended = () => {
        if (activeAudioElement === audio) {
          activeAudioElement = null;
          notifyListeners(null);
        }
      };

      audio.onerror = () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          tryNextUrl();
        }
      };

      audio.src = url;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            tryNextUrl();
          }
        });
      }
    }

    tryNextUrl();
  });
}

/**
 * Speaks any English word or sentence in authentic native American (`us` / `en-US`)
 * or British (`uk` / `en-GB`) English.
 */
export async function speakEnglishText(
  text: string,
  accent: EnglishAccent = 'us'
): Promise<boolean> {
  const cleaned = cleanEnglishForSpeech(text);
  if (!cleaned || typeof window === 'undefined') return false;

  stopCurrentAudio();
  notifyListeners({ text: cleaned, accent });

  // For British English (UK), prioritize the native MALE British voice
  // (Google UK English Male, Microsoft Ryan, Apple Daniel, etc.) with baritone pitch (0.84)
  if (accent === 'uk' && 'speechSynthesis' in window) {
    const maleVoice = cachedUkVoice || pickBritishEnglishVoice();
    if (maleVoice) {
      try {
        const utter = new SpeechSynthesisUtterance(cleaned);
        utter.voice = maleVoice;
        utter.lang = 'en-GB';
        // Distinct masculine baritone pitch (0.84) and distinguished British RP cadence (0.89)
        utter.pitch = 0.84;
        utter.rate = 0.89;
        utter.onend = () => notifyListeners(null);
        utter.onerror = () => notifyListeners(null);

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utter);
        return true;
      } catch {
        // Fall back to cloud audio if Web Speech has any exception
      }
    }
  }

  // Cloud stream path (for US female teacher voice, or UK male studio fallback)
  try {
    await playCloudNativeTTS(cleaned, accent);
    return true;
  } catch {
    // Offline fallback: use strictly verified regional Web Speech API voice (en-US vs en-GB)
  }

  if ('speechSynthesis' in window) {
    try {
      const targetLang = accent === 'uk' ? 'en-GB' : 'en-US';
      const voice =
        accent === 'uk'
          ? cachedUkVoice || pickBritishEnglishVoice()
          : cachedUsVoice || pickAmericanEnglishVoice();

      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.lang = targetLang;
      // High contrast: Male baritone (0.84) for UK vs Female/Teacher (1.02) for US
      utter.pitch = accent === 'uk' ? 0.84 : 1.02;
      utter.rate = accent === 'uk' ? 0.89 : 0.94;
      utter.onend = () => notifyListeners(null);
      utter.onerror = () => notifyListeners(null);

      if (voice) {
        utter.voice = voice;
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utter);
        return true;
      }

      // Give browser 100ms to populate voices if cold-booting offline
      window.setTimeout(() => {
        const delayed = pickNativeEnglishVoice(accent);
        if (delayed) {
          utter.voice = delayed;
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utter);
        } else {
          notifyListeners(null);
        }
      }, 100);
      return true;
    } catch {
      notifyListeners(null);
      return false;
    }
  }

  notifyListeners(null);
  return false;
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

/**
 * Initiates speech recognition in English (en-US by default) for search queries.
 * Returns a controller with stop() and abort() methods.
 */
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
