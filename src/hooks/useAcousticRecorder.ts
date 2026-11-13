import { useCallback, useEffect, useRef, useState } from 'react';
import {
  describeMicrophoneError,
  evaluatePronunciationAudio,
  getActiveMicrophoneTracksCount,
  negotiateSupportedRecorderMimeType,
  OfflinePronunciationError,
  registerActiveMicrophoneStream,
  releaseMicrophoneStream,
  type MicrophonePermissionErrorInfo,
} from '../services/platform/acousticPronunciationService';
import {
  getActiveAudioPlayback,
  stopCurrentAudio,
  subscribeAudioPlayback,
  toggleRecordedBlobAudio,
} from '../services/platform/speechService';
import type {
  PronunciationAccent,
  PronunciationEvaluationResult,
  PronunciationMode,
} from '../utils/pronunciationEngine';

export type AcousticRecorderStatus =
  | 'idle'
  | 'requesting_mic'
  | 'recording'
  | 'evaluating';

const DEFAULT_WAVE_BARS = new Array(16).fill(0.12) as number[];

export interface UseAcousticRecorderOptions {
  targetText: string;
  accent: PronunciationAccent;
  mode: PronunciationMode;
  maxDurationMs?: number;
  onEvaluated?: (result: PronunciationEvaluationResult, targetText: string) => void;
}

export function useAcousticRecorder({
  targetText,
  accent,
  mode,
  maxDurationMs = mode === 'card-quick' ? 10000 : 12000,
  onEvaluated,
}: UseAcousticRecorderOptions) {
  const [status, setStatus] = useState<AcousticRecorderStatus>('idle');
  const [voiceLevel, setVoiceLevel] = useState<number>(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(DEFAULT_WAVE_BARS);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlayingOwnAudio, setIsPlayingOwnAudio] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluationResult | null>(null);
  const [micError, setMicError] = useState<MicrophonePermissionErrorInfo | null>(null);
  const [offlineSelfCheckNotice, setOfflineSelfCheckNotice] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtMsRef = useRef<number>(0);
  const lastUiFrameMsRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recorderPlaybackIdRef = useRef<string>(
    `student-own-recording-${Math.random().toString(36).slice(2, 8)}`
  );
  const recordedUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const discardOnStopRef = useRef<boolean>(false);

  // Keep latest props in refs for async MediaRecorder callbacks
  const latestPropsRef = useRef({ targetText, accent, mode, onEvaluated });
  latestPropsRef.current = { targetText, accent, mode, onEvaluated };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (
        window as unknown as { __ewmGetActiveMicTracks?: () => number }
      ).__ewmGetActiveMicTracks = getActiveMicrophoneTracksCount;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const ownSourceId = recorderPlaybackIdRef.current;
    return subscribeAudioPlayback((active) => {
      if (!isMountedRef.current) return;
      setIsPlayingOwnAudio(
        Boolean(active && active.role === 'recording' && active.sourceId === ownSourceId)
      );
    });
  }, []);

  const stopOwnPlayback = useCallback(() => {
    const active = getActiveAudioPlayback();
    if (active?.role === 'recording' && active.sourceId === recorderPlaybackIdRef.current) {
      stopCurrentAudio();
    }
    if (isMountedRef.current) {
      setIsPlayingOwnAudio(false);
    }
  }, []);

  const releaseHardwareCapture = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // ignore
      }
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx.state !== 'closed') {
        void ctx.close().catch(() => {});
      }
    }
    if (streamRef.current) {
      releaseMicrophoneStream(streamRef.current);
      streamRef.current = null;
    }
    if (isMountedRef.current) {
      setVoiceLevel(0);
      setWaveformBars(DEFAULT_WAVE_BARS);
    }
  }, []);

  const revokeRecordedObjectUrl = useCallback(() => {
    if (recordedUrlRef.current) {
      try {
        URL.revokeObjectURL(recordedUrlRef.current);
      } catch {
        // ignore
      }
      recordedUrlRef.current = null;
    }
  }, []);

  const cancelEverything = useCallback(() => {
    discardOnStopRef.current = true;
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // ignore
      }
      abortControllerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    releaseHardwareCapture();
    stopOwnPlayback();
    if (isMountedRef.current) {
      setStatus('idle');
    }
  }, [releaseHardwareCapture, stopOwnPlayback]);

  const resetEvaluationAndRecording = useCallback(() => {
    cancelEverything();
    revokeRecordedObjectUrl();
    if (isMountedRef.current) {
      setRecordedBlob(null);
      setRecordedUrl(null);
      setEvaluation(null);
      setMicError(null);
      setOfflineSelfCheckNotice(null);
      setNetworkError(null);
      setElapsedMs(0);
    }
  }, [cancelEverything, revokeRecordedObjectUrl]);

  // Automatically reset evaluation when targetText changes so stale verdicts never linger on a new phrase
  const prevTargetRef = useRef<string>(targetText);
  useEffect(() => {
    if (prevTargetRef.current !== targetText) {
      prevTargetRef.current = targetText;
      resetEvaluationAndRecording();
    }
  }, [targetText, resetEvaluationAndRecording]);

  // Strict hardware hygiene on tab backgrounding and component unmount
  useEffect(() => {
    isMountedRef.current = true;
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          cancelEverything();
        } else {
          releaseHardwareCapture();
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      isMountedRef.current = false;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      cancelEverything();
      revokeRecordedObjectUrl();
    };
  }, [cancelEverything, releaseHardwareCapture, revokeRecordedObjectUrl]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      discardOnStopRef.current = false;
      try {
        rec.stop();
        return;
      } catch {
        // fallback cleanup below
      }
    }
    releaseHardwareCapture();
  }, [releaseHardwareCapture]);

  const startRecording = useCallback(async () => {
    if (status === 'requesting_mic' || status === 'recording') return;

    // Stop any native TTS or local replay so speaker output never bleeds into the microphone
    stopCurrentAudio();
    stopOwnPlayback();

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // ignore
      }
      abortControllerRef.current = null;
    }

    releaseHardwareCapture();
    setMicError(null);
    setNetworkError(null);
    setOfflineSelfCheckNotice(null);
    setEvaluation(null);
    setElapsedMs(0);
    discardOnStopRef.current = false;

    if (
      typeof window === 'undefined' ||
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMicError(describeMicrophoneError(new Error('Unsupported MediaRecorder')));
      return;
    }

    setStatus('requesting_mic');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      if (isMountedRef.current) {
        setStatus('idle');
        setMicError(describeMicrophoneError(err));
      }
      return;
    }

    if (!isMountedRef.current) {
      releaseMicrophoneStream(stream);
      return;
    }

    registerActiveMicrophoneStream(stream);
    streamRef.current = stream;

    // Attach Web Audio AnalyserNode for real-time voice level & waveform visualization
    try {
      const AudioCtxConstructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtxConstructor) {
        const audioCtx = new AudioCtxConstructor();
        if (audioCtx.state === 'suspended') {
          void audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        sourceNodeRef.current = source;
        analyserRef.current = analyser;
      }
    } catch {
      // Analyser is purely visual; continue recording safely even if WebAudio graph fails
    }

    const negotiatedMime = negotiateSupportedRecorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = negotiatedMime
        ? new MediaRecorder(stream, {
            mimeType: negotiatedMime,
            audioBitsPerSecond: 64000,
          })
        : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        releaseHardwareCapture();
        setStatus('idle');
        setMicError(describeMicrophoneError(err));
        return;
      }
    }

    chunksRef.current = [];
    mediaRecorderRef.current = recorder;
    startedAtMsRef.current = performance.now();
    lastUiFrameMsRef.current = 0;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      releaseHardwareCapture();
      if (isMountedRef.current) {
        setStatus('idle');
        setNetworkError('Ocorreu uma falha durante a captura do áudio. Tente gravar novamente.');
      }
    };

    recorder.onstop = () => {
      const effectiveMime =
        recorder.mimeType || negotiatedMime || 'audio/webm';
      const collectedChunks = chunksRef.current;
      chunksRef.current = [];
      mediaRecorderRef.current = null;

      // IMMEDIATELY release hardware tracks & AudioContext so OS mic indicator turns off right away
      releaseHardwareCapture();

      if (!isMountedRef.current || discardOnStopRef.current) {
        return;
      }

      const blob = new Blob(collectedChunks, { type: effectiveMime });
      revokeRecordedObjectUrl();
      const nextUrl = URL.createObjectURL(blob);
      recordedUrlRef.current = nextUrl;
      setRecordedBlob(blob);
      setRecordedUrl(nextUrl);

      const snapshot = latestPropsRef.current;

      // Offline graceful resilience: keep local recording playable (0ms) + show clear offline notice
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus('idle');
        setOfflineSelfCheckNotice(
          'Você está offline: a avaliação fonética profunda por IA requer internet, mas sua gravação já está pronta! Use "▶️ Minha Voz" e "🔊 Ouvir Nativo" para comparar de ouvido.'
        );
        return;
      }

      setStatus('evaluating');
      const controller = new AbortController();
      abortControllerRef.current = controller;

      void evaluatePronunciationAudio({
        audioBlob: blob,
        mimeType: effectiveMime,
        targetText: snapshot.targetText,
        accent: snapshot.accent,
        mode: snapshot.mode,
        signal: controller.signal,
      })
        .then((res) => {
          if (!isMountedRef.current || abortControllerRef.current !== controller) return;
          abortControllerRef.current = null;
          setEvaluation(res);
          setStatus('idle');
          snapshot.onEvaluated?.(res, snapshot.targetText);
        })
        .catch((err) => {
          if (!isMountedRef.current || abortControllerRef.current !== controller) return;
          abortControllerRef.current = null;
          setStatus('idle');
          if ((err as { name?: string })?.name === 'AbortError') return;
          if (err instanceof OfflinePronunciationError) {
            setOfflineSelfCheckNotice(err.message);
          } else {
            setNetworkError(
              err instanceof Error
                ? err.message
                : 'Falha ao avaliar pronúncia. Tente gravar novamente.'
            );
          }
        });
    };

    try {
      recorder.start(150);
    } catch (err) {
      releaseHardwareCapture();
      setStatus('idle');
      setMicError(describeMicrophoneError(err));
      return;
    }

    setStatus('recording');

    // Start real-time AnalyserNode loop (~30fps UI updates)
    const timeDomainBuf = new Uint8Array(128);
    const freqBuf = new Uint8Array(64);

    const tick = (nowMs: number) => {
      if (!streamRef.current) return;
      if (nowMs - lastUiFrameMsRef.current >= 34) {
        lastUiFrameMsRef.current = nowMs;
        const elapsed = Math.max(0, Math.round(nowMs - startedAtMsRef.current));
        setElapsedMs(elapsed);

        const analyser = analyserRef.current;
        if (analyser) {
          analyser.getByteTimeDomainData(timeDomainBuf);
          analyser.getByteFrequencyData(freqBuf);

          let sumSq = 0;
          for (let i = 0; i < timeDomainBuf.length; i++) {
            const norm = (timeDomainBuf[i] - 128) / 128;
            sumSq += norm * norm;
          }
          const rms = Math.sqrt(sumSq / timeDomainBuf.length);
          const boostedLevel = Math.min(1, rms * 3.8);
          setVoiceLevel(boostedLevel);

          const bars: number[] = [];
          for (let b = 0; b < 16; b++) {
            const idx = Math.min(freqBuf.length - 1, Math.floor((b * 28) / 16) + 1);
            const rawVal = freqBuf[idx] / 255;
            bars.push(Math.max(0.12, Math.min(1, rawVal * 1.15 + boostedLevel * 0.25)));
          }
          setWaveformBars(bars);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    maxTimerRef.current = setTimeout(() => {
      stopRecording();
    }, maxDurationMs);
  }, [maxDurationMs, releaseHardwareCapture, revokeRecordedObjectUrl, status, stopOwnPlayback, stopRecording]);

  const togglePlayOwnRecording = useCallback(() => {
    if (!recordedUrl) return;
    void toggleRecordedBlobAudio(recordedUrl, {
      blob: recordedBlob,
      sourceId: recorderPlaybackIdRef.current,
      accent: accent === 'en-GB' ? 'uk' : 'us',
    });
  }, [accent, recordedBlob, recordedUrl]);

  return {
    status,
    voiceLevel,
    waveformBars,
    elapsedMs,
    maxDurationMs,
    recordedBlob,
    recordedUrl,
    isPlayingOwnAudio,
    evaluation,
    micError,
    offlineSelfCheckNotice,
    networkError,
    isOnline,
    startRecording,
    stopRecording,
    togglePlayOwnRecording,
    stopOwnPlayback,
    resetEvaluationAndRecording,
    cancelEverything,
  };
}
