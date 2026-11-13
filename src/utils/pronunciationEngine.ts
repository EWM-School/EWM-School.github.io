export type AudioQualityStatus =
  | 'CLEAR'
  | 'NO_SPEECH_DETECTED'
  | 'TOO_NOISY_OR_LOW'
  | 'WRONG_LANGUAGE';

export type WordPronunciationStatus =
  | 'EXACT'
  | 'CLOSE_NEEDS_POLISH'
  | 'MISPRONOUNCED_OR_MISSING';

export type PronunciationVerdict =
  | 'NATIVE_LIKE'
  | 'UNDERSTANDABLE_POLISH'
  | 'NEEDS_PRACTICE';

export type PronunciationAccent = 'en-US' | 'en-GB';
export type PronunciationMode = 'card-quick' | 'lab-detailed';

export interface WordBreakdownItem {
  word: string;
  status: WordPronunciationStatus;
  phoneticCuePtBr: string;
  tipPtBr: string;
}

export interface RawPronunciationPayload {
  audioQualityStatus?: string;
  heardTranscript?: string;
  wordBreakdown?: Array<{
    word?: string;
    status?: string;
    phoneticCuePtBr?: string;
    tipPtBr?: string;
  }>;
  overallScore?: number;
  verdict?: string;
  coachSummaryPtBr?: string;
}

export interface PronunciationEvaluationResult {
  audioQualityStatus: AudioQualityStatus;
  heardTranscript: string;
  wordBreakdown: WordBreakdownItem[];
  overallScore: number;
  verdict: PronunciationVerdict;
  coachSummaryPtBr: string;
  accent: PronunciationAccent;
  mode: PronunciationMode;
  invariantClamped?: boolean;
}

const VALID_AUDIO_QUALITY = new Set<AudioQualityStatus>([
  'CLEAR',
  'NO_SPEECH_DETECTED',
  'TOO_NOISY_OR_LOW',
  'WRONG_LANGUAGE',
]);

const VALID_WORD_STATUS = new Set<WordPronunciationStatus>([
  'EXACT',
  'CLOSE_NEEDS_POLISH',
  'MISPRONOUNCED_OR_MISSING',
]);

const VALID_VERDICTS = new Set<PronunciationVerdict>([
  'NATIVE_LIKE',
  'UNDERSTANDABLE_POLISH',
  'NEEDS_PRACTICE',
]);

const SUPPORTED_GEMINI_AUDIO_MIMES: Readonly<Record<string, string>> = {
  'audio/webm': 'audio/webm',
  'video/webm': 'audio/webm',
  'audio/ogg': 'audio/ogg',
  'application/ogg': 'audio/ogg',
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/aac': 'audio/aac',
  'audio/wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/flac': 'audio/flac',
};

/**
 * Strips codec parameters (e.g. `audio/webm;codecs=opus` -> `audio/webm`)
 * so Gemini Multimodal `inlineData.mimeType` receives a clean IANA audio MIME type.
 */
export function normalizeAudioMimeType(rawMime: unknown): string | null {
  const raw = String(rawMime || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'audio/webm';
  const baseMime = raw.split(';')[0]?.trim() || '';
  return SUPPORTED_GEMINI_AUDIO_MIMES[baseMime] || null;
}

/**
 * Removes optional `data:audio/...;base64,` prefix and whitespace from base64 audio payloads.
 */
export function stripBase64DataUrlPrefix(rawBase64: unknown): string {
  const str = String(rawBase64 || '').trim();
  if (!str) return '';
  const commaIdx = str.indexOf(',');
  if (str.startsWith('data:') && commaIdx !== -1) {
    return str.slice(commaIdx + 1).replace(/\s+/g, '');
  }
  return str.replace(/\s+/g, '');
}

/**
 * Inspects decoded audio bytes on the server before invoking Gemini Multimodal,
 * catching empty payloads, sub-frame buffers, zero-filled streams, and silent WAV/PCM clips in 0ms.
 */
export function detectDigitalSilenceInAudioBytes(
  bytes: Uint8Array,
  cleanMimeType: string
): { isSilentOrTooTiny: boolean; rms?: number; reason?: string } {
  if (!bytes || bytes.byteLength < 320) {
    return { isSilentOrTooTiny: true, reason: 'TINY_AUDIO_BUFFER' };
  }

  // RIFF WAVE PCM / IEEE Float exact acoustic RMS inspection
  const isRiffWave =
    bytes.byteLength >= 44 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45; // E

  if (isRiffWave || cleanMimeType === 'audio/wav') {
    if (isRiffWave) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let audioFormat = 1;
      let bitsPerSample = 16;
      let dataOffset = -1;
      let dataLength = 0;

      let offset = 12;
      while (offset + 8 <= bytes.byteLength) {
        const chunkId = String.fromCharCode(
          bytes[offset],
          bytes[offset + 1],
          bytes[offset + 2],
          bytes[offset + 3]
        );
        const chunkSize = view.getUint32(offset + 4, true);
        const payloadStart = offset + 8;

        if (chunkId === 'fmt ' && payloadStart + 16 <= bytes.byteLength) {
          audioFormat = view.getUint16(payloadStart, true);
          bitsPerSample = view.getUint16(payloadStart + 14, true);
        } else if (chunkId === 'data') {
          dataOffset = payloadStart;
          dataLength = Math.min(chunkSize, bytes.byteLength - payloadStart);
          break;
        }

        offset = payloadStart + chunkSize + (chunkSize % 2);
      }

      if (dataOffset === -1 || dataLength < 64) {
        return { isSilentOrTooTiny: true, reason: 'EMPTY_WAV_DATA' };
      }

      let sumSquares = 0;
      let sampleCount = 0;

      if (audioFormat === 1 && bitsPerSample === 16) {
        for (let i = dataOffset; i + 1 < dataOffset + dataLength; i += 2) {
          const sample = view.getInt16(i, true) / 32768;
          sumSquares += sample * sample;
          sampleCount++;
        }
      } else if (audioFormat === 1 && bitsPerSample === 8) {
        for (let i = dataOffset; i < dataOffset + dataLength; i++) {
          const sample = (bytes[i] - 128) / 128;
          sumSquares += sample * sample;
          sampleCount++;
        }
      } else if (audioFormat === 3 && bitsPerSample === 32) {
        for (let i = dataOffset; i + 3 < dataOffset + dataLength; i += 4) {
          const sample = view.getFloat32(i, true);
          if (Number.isFinite(sample)) {
            sumSquares += sample * sample;
            sampleCount++;
          }
        }
      }

      if (sampleCount > 0) {
        const rms = Math.sqrt(sumSquares / sampleCount);
        if (rms < 0.0035) {
          return { isSilentOrTooTiny: true, rms, reason: 'SILENT_WAV_PCM' };
        }
        return { isSilentOrTooTiny: false, rms };
      }
    }
  }

  // Container-agnostic zero-payload check (after initial header bytes)
  const inspectStart = Math.min(128, Math.floor(bytes.byteLength / 4));
  let nonZeroCount = 0;
  for (let i = inspectStart; i < bytes.byteLength; i++) {
    if (bytes[i] !== 0x00 && bytes[i] !== 0xff) {
      nonZeroCount++;
      if (nonZeroCount >= 32) {
        return { isSilentOrTooTiny: false };
      }
    }
  }

  return { isSilentOrTooTiny: true, reason: 'ZERO_FILLED_PAYLOAD' };
}

/**
 * Extracts ordered surface words from `targetText` while preserving contractions (`don't`, `it's`)
 * and hyphenated compounds (`follow-up`, `well-known`).
 */
export function tokenizeTargetWords(targetText: string): string[] {
  const cleaned = String(targetText || '')
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, ' ')
    .trim();
  if (!cleaned) return [];

  return cleaned
    .split(/\s+/)
    .map((rawToken) => rawToken.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, ''))
    .filter((token) => token.length > 0);
}

function normalizeWordForAlignment(word: string): string {
  return String(word || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']/g, '');
}

/**
 * Produces a deterministic canonical key per English target phrase for daily XP anti-farming.
 */
export function toSpeakingPhraseDailyKey(targetText: string): string {
  return tokenizeTargetWords(targetText)
    .map((w) => normalizeWordForAlignment(w))
    .filter(Boolean)
    .join('_')
    .slice(0, 120);
}

function cleanPtText(raw: unknown, fallback: string): string {
  const cleaned = String(raw || '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function buildNonClearPronunciationResult(
  status: Exclude<AudioQualityStatus, 'CLEAR'>,
  accent: PronunciationAccent,
  mode: PronunciationMode,
  heardTranscript = ''
): PronunciationEvaluationResult {
  const messages: Record<Exclude<AudioQualityStatus, 'CLEAR'>, string> = {
    NO_SPEECH_DETECTED:
      'Não detectamos voz clara na gravação. Aproxime-se um pouco do microfone e fale a frase com naturalidade.',
    TOO_NOISY_OR_LOW:
      'O volume ficou muito baixo ou com ruído de fundo. Tente gravar em um ambiente mais silencioso.',
    WRONG_LANGUAGE:
      'Ouvimos outro idioma na gravação. Leia a expressão em inglês exibida na tela e tente novamente.',
  };

  return {
    audioQualityStatus: status,
    heardTranscript: cleanPtText(heardTranscript, ''),
    wordBreakdown: [],
    overallScore: 0,
    verdict: 'NEEDS_PRACTICE',
    coachSummaryPtBr: messages[status],
    accent,
    mode,
  };
}

function isSilentTranscriptPlaceholder(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return true;
  return /^(?:\[?(?:silence|inaudible|no speech|noise|empty|silêncio|inaudível|sem fala|ruído)\]?|\.+|-+)$/i.test(
    lower
  );
}

/**
 * Enforces strict deterministic pedagogical and mathematical invariants on Gemini's phonetic output:
 * 1. Non-CLEAR `audioQualityStatus` (or empty `heardTranscript`) NEVER hallucinates a score or word approval.
 * 2. `wordBreakdown` is strictly aligned 1-to-1 with `tokenizeTargetWords(targetText)`.
 * 3. Hardcoded Mathematical Lock: If ANY word is marked `MISPRONOUNCED_OR_MISSING`,
 *    `verdict` can NEVER be `NATIVE_LIKE` and `overallScore` can NEVER exceed `84`.
 */
export function enforceDeterministicPronunciationInvariants(
  raw: Partial<RawPronunciationPayload> | null | undefined,
  targetText: string,
  accent: PronunciationAccent,
  mode: PronunciationMode
): PronunciationEvaluationResult {
  const rawQuality = String(raw?.audioQualityStatus || '')
    .trim()
    .toUpperCase() as AudioQualityStatus;
  const audioQualityStatus: AudioQualityStatus = VALID_AUDIO_QUALITY.has(rawQuality)
    ? rawQuality
    : 'NO_SPEECH_DETECTED';

  const heardTranscript = cleanPtText(raw?.heardTranscript, '');

  if (audioQualityStatus !== 'CLEAR') {
    return buildNonClearPronunciationResult(
      audioQualityStatus,
      accent,
      mode,
      heardTranscript
    );
  }

  if (isSilentTranscriptPlaceholder(heardTranscript)) {
    return buildNonClearPronunciationResult('NO_SPEECH_DETECTED', accent, mode, '');
  }

  const targetWords = tokenizeTargetWords(targetText);
  if (targetWords.length === 0) {
    return buildNonClearPronunciationResult('NO_SPEECH_DETECTED', accent, mode, heardTranscript);
  }

  const rawBreakdown = Array.isArray(raw?.wordBreakdown) ? raw.wordBreakdown : [];
  let cursor = 0;

  const alignedBreakdown: WordBreakdownItem[] = targetWords.map((targetWord) => {
    const normTarget = normalizeWordForAlignment(targetWord);
    let matchedIdx = -1;

    // Look ahead up to 3 positions so a single omitted/inserted word does not misalign the rest of the sentence
    for (let offset = 0; offset <= 3 && cursor + offset < rawBreakdown.length; offset++) {
      const candidate = rawBreakdown[cursor + offset];
      const normCandidate = normalizeWordForAlignment(candidate?.word || '');
      if (normCandidate && normCandidate === normTarget) {
        matchedIdx = cursor + offset;
        break;
      }
    }

    // Fallback positional match if same length array was returned by model
    if (
      matchedIdx === -1 &&
      rawBreakdown.length === targetWords.length &&
      cursor < rawBreakdown.length
    ) {
      matchedIdx = cursor;
    }

    if (matchedIdx !== -1) {
      cursor = matchedIdx + 1;
      const item = rawBreakdown[matchedIdx];
      const candidateStatus = String(item?.status || '')
        .trim()
        .toUpperCase() as WordPronunciationStatus;
      const status: WordPronunciationStatus = VALID_WORD_STATUS.has(candidateStatus)
        ? candidateStatus
        : 'MISPRONOUNCED_OR_MISSING';

      const defaultCue = targetWord;
      const defaultTip =
        status === 'EXACT'
          ? 'Pronúncia clara e natural!'
          : status === 'CLOSE_NEEDS_POLISH'
          ? 'Quase lá! Ouça o modelo nativo e refine a vogal e o ritmo desta palavra.'
          : 'Esta palavra não soou clara. Toque nela para ouvir o modelo nativo e repita devagar.';

      return {
        word: targetWord,
        status,
        phoneticCuePtBr: cleanPtText(item?.phoneticCuePtBr, defaultCue),
        tipPtBr: cleanPtText(item?.tipPtBr, defaultTip),
      };
    }

    return {
      word: targetWord,
      status: 'MISPRONOUNCED_OR_MISSING',
      phoneticCuePtBr: targetWord,
      tipPtBr:
        'Esta palavra não foi ouvida com clareza na gravação. Ouça o áudio nativo e articule cada som.',
    };
  });

  const mispronouncedCount = alignedBreakdown.filter(
    (w) => w.status === 'MISPRONOUNCED_OR_MISSING'
  ).length;
  const polishCount = alignedBreakdown.filter(
    (w) => w.status === 'CLOSE_NEEDS_POLISH'
  ).length;

  let score =
    typeof raw?.overallScore === 'number' && Number.isFinite(raw.overallScore)
      ? Math.round(Math.max(0, Math.min(100, raw.overallScore)))
      : mispronouncedCount === 0 && polishCount === 0
      ? 92
      : mispronouncedCount === 0
      ? 78
      : 48;

  const rawVerdictStr = String(raw?.verdict || '')
    .trim()
    .toUpperCase() as PronunciationVerdict;
  let verdict: PronunciationVerdict = VALID_VERDICTS.has(rawVerdictStr)
    ? rawVerdictStr
    : score >= 85
    ? 'NATIVE_LIKE'
    : score >= 60
    ? 'UNDERSTANDABLE_POLISH'
    : 'NEEDS_PRACTICE';

  let invariantClamped = false;

  // HARDCODED MATHEMATICAL INVARIANT:
  // Any MISPRONOUNCED_OR_MISSING word strictly forbids `NATIVE_LIKE` and caps `overallScore <= 84`.
  if (mispronouncedCount > 0) {
    if (score > 84) {
      score = 84;
      invariantClamped = true;
    }
    if (verdict === 'NATIVE_LIKE') {
      verdict = score >= 60 ? 'UNDERSTANDABLE_POLISH' : 'NEEDS_PRACTICE';
      invariantClamped = true;
    }

    // If half or more of the target phrase was missed/mispronounced, enforce NEEDS_PRACTICE
    if (mispronouncedCount / alignedBreakdown.length >= 0.5) {
      if (score > 59) {
        score = 58;
        invariantClamped = true;
      }
      if (verdict !== 'NEEDS_PRACTICE') {
        verdict = 'NEEDS_PRACTICE';
        invariantClamped = true;
      }
    }
  }

  // Score <-> Verdict band consistency
  if (score < 60) {
    verdict = 'NEEDS_PRACTICE';
  } else if (score <= 84 && verdict === 'NATIVE_LIKE') {
    verdict = 'UNDERSTANDABLE_POLISH';
    invariantClamped = true;
  } else if (score >= 85 && mispronouncedCount === 0 && polishCount === 0) {
    verdict = 'NATIVE_LIKE';
  }

  const defaultSummary =
    verdict === 'NATIVE_LIKE'
      ? 'Excelente ritmo e articulação! Sua pronúncia soou muito natural.'
      : verdict === 'UNDERSTANDABLE_POLISH'
      ? 'Boa comunicação! Ajuste apenas os detalhes destacados em amarelo/vermelho para soar ainda mais natural.'
      : 'Continue praticando: toque nas palavras destacadas para ouvir o modelo nativo e grave novamente.';

  return {
    audioQualityStatus: 'CLEAR',
    heardTranscript,
    wordBreakdown: alignedBreakdown,
    overallScore: score,
    verdict,
    coachSummaryPtBr: cleanPtText(raw?.coachSummaryPtBr, defaultSummary),
    accent,
    mode,
    ...(invariantClamped ? { invariantClamped: true } : {}),
  };
}
