import { Capacitor } from '@capacitor/core';
import {
  buildNonClearPronunciationResult,
  enforceDeterministicPronunciationInvariants,
  normalizeAudioMimeType,
  type PronunciationAccent,
  type PronunciationEvaluationResult,
  type PronunciationMode,
} from '../../utils/pronunciationEngine';

export const UNIVERSAL_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export type MicrophoneErrorKind =
  | 'PERMISSION_DENIED'
  | 'NO_DEVICE'
  | 'HARDWARE_BUSY'
  | 'UNSUPPORTED_BROWSER'
  | 'UNKNOWN';

export interface MicrophonePermissionErrorInfo {
  kind: MicrophoneErrorKind;
  titlePtBr: string;
  instructionsPtBr: string;
}

/**
 * Global registry of active microphone MediaStreams across the app
 * to guarantee 100% hardware track release on stop, modal close, or tab switch.
 */
const activeMicrophoneStreams = new Set<MediaStream>();

export function registerActiveMicrophoneStream(stream: MediaStream): void {
  activeMicrophoneStreams.add(stream);
}

export function releaseMicrophoneStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore already-stopped track errors
      }
    });
  } catch {
    // ignore
  }
  activeMicrophoneStreams.delete(stream);
}

export function releaseAllActiveMicrophoneStreams(): void {
  for (const stream of Array.from(activeMicrophoneStreams)) {
    releaseMicrophoneStream(stream);
  }
  activeMicrophoneStreams.clear();
}

export function getActiveMicrophoneTracksCount(): number {
  let liveCount = 0;
  for (const stream of Array.from(activeMicrophoneStreams)) {
    const liveTracks = stream
      .getTracks()
      .filter((t) => t.readyState === 'live');
    if (liveTracks.length === 0) {
      activeMicrophoneStreams.delete(stream);
    } else {
      liveCount += liveTracks.length;
    }
  }
  return liveCount;
}

/**
 * Selects the best supported MediaRecorder MIME type across Windows Chrome/Edge,
 * Android Capacitor WebView, Firefox, and iOS/macOS Safari without throwing NotSupportedError.
 */
export function negotiateSupportedRecorderMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }
  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  for (const candidate of UNIVERSAL_RECORDER_MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // continue probing next MIME type
    }
  }
  return '';
}

export function describeMicrophoneError(err: unknown): MicrophonePermissionErrorInfo {
  const name = String((err as { name?: string })?.name || '');
  const msg = String((err as { message?: string })?.message || '').toLowerCase();

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    msg.includes('permission') ||
    msg.includes('denied')
  ) {
    return {
      kind: 'PERMISSION_DENIED',
      titlePtBr: 'Acesso ao microfone bloqueado',
      instructionsPtBr:
        'Clique no ícone de cadeado ou configurações ao lado da barra de endereço do navegador (ou em Ajustes > Aplicativos > EWM no celular), permita o uso do Microfone e tente gravar novamente.',
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      kind: 'NO_DEVICE',
      titlePtBr: 'Nenhum microfone encontrado',
      instructionsPtBr:
        'Conecte um fone com microfone ou verifique se o dispositivo de entrada de áudio está ativado no sistema.',
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      kind: 'HARDWARE_BUSY',
      titlePtBr: 'Microfone em uso por outro aplicativo',
      instructionsPtBr:
        'Feche chamadas ou gravadores abertos em segundo plano que possam estar bloqueando seu microfone e tente de novo.',
    };
  }

  if (
    typeof window === 'undefined' ||
    !navigator?.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    return {
      kind: 'UNSUPPORTED_BROWSER',
      titlePtBr: 'Gravação de áudio indisponível neste navegador',
      instructionsPtBr:
        'Abra o EWM no Google Chrome, Microsoft Edge, Safari atualizado ou no aplicativo oficial para usar o avaliador acústico.',
    };
  }

  return {
    kind: 'UNKNOWN',
    titlePtBr: 'Não foi possível iniciar o microfone',
    instructionsPtBr:
      'Verifique as permissões de áudio do seu navegador ou celular e tente gravar novamente.',
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function resolvePronunciationEndpoint(): string | null {
  const configuredBase = (
    import.meta.env?.VITE_API_BASE_URL as string | undefined
  )?.replace(/\/+$/, '');
  if (Capacitor.isNativePlatform()) {
    return configuredBase
      ? `${configuredBase}/api/gemini/evaluate-pronunciation`
      : 'https://ewm-school.github.io/api/gemini/evaluate-pronunciation';
  }
  return configuredBase
    ? `${configuredBase}/api/gemini/evaluate-pronunciation`
    : '/api/gemini/evaluate-pronunciation';
}

export class OfflinePronunciationError extends Error {
  readonly code = 'OFFLINE_PRONUNCIATION' as const;
  constructor(
    message = 'A avaliação acústica profunda requer conexão com a internet. Você ainda pode ouvir sua própria gravação e comparar com o modelo nativo!'
  ) {
    super(message);
    this.name = 'OfflinePronunciationError';
  }
}

export async function evaluatePronunciationAudio(params: {
  audioBlob: Blob;
  mimeType: string;
  targetText: string;
  accent: PronunciationAccent;
  mode: PronunciationMode;
  signal?: AbortSignal;
}): Promise<PronunciationEvaluationResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OfflinePronunciationError();
  }

  if (!params.audioBlob || params.audioBlob.size < 320) {
    return buildNonClearPronunciationResult(
      'NO_SPEECH_DETECTED',
      params.accent,
      params.mode
    );
  }

  const endpoint = resolvePronunciationEndpoint();
  if (!endpoint) {
    throw new OfflinePronunciationError();
  }

  const cleanMimeType =
    normalizeAudioMimeType(params.mimeType || params.audioBlob.type) || 'audio/webm';
  const audioBase64 = await blobToBase64(params.audioBlob);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: cleanMimeType,
        targetText: params.targetText,
        accent: params.accent,
        mode: params.mode,
      }),
      signal: params.signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw err;
    }
    throw new OfflinePronunciationError();
  }

  const data = (await response.json().catch(() => null)) as {
    success?: boolean;
    reason?: string;
    error?: string;
    evaluation?: PronunciationEvaluationResult;
  } | null;

  if (!response.ok || !data?.success || !data.evaluation) {
    throw new Error(
      data?.error ||
        'Não foi possível concluir a análise acústica neste momento. Tente gravar novamente.'
    );
  }

  return enforceDeterministicPronunciationInvariants(
    data.evaluation,
    params.targetText,
    params.accent,
    params.mode
  );
}
