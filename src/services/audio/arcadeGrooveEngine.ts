/**
 * Procedural Web Audio Dynamic Groove Engine (`arcadeGrooveEngine.ts`)
 *
 * Pure native `AudioContext` synthesizer (zero external `.mp3` assets):
 * - Warm low-pass filtered sub-bass pulse + gentle pentatonic arpeggio
 *   calibrated for low auditory fatigue (`~0.085` peak gain) to induce focus & agility
 *   during `Memória Relâmpago` (`Lightning Match`).
 * - Crystalline micro-chord chime (`playArcadeMatchChime`) on pair match.
 * - Strict lifecycle hygiene: immediately stops oscillators/scheduler on exit,
 *   tab switch (`visibilitychange`), window blur, `pagehide`, or unmount.
 */

const ARCADE_MUSIC_STORAGE_KEY = 'ewm_arcade_music_enabled';

const BPM = 118;
const SIXTEENTH_MS = Math.round((60 / BPM / 4) * 1000); // ~127ms per 16th note

// Warm Fmaj9 -> Dm9 -> Bbmaj7 -> C6 bass roots (Hz)
const BASS_ROOTS_HZ = [87.31, 73.42, 58.27, 65.41];

// Gentle D-minor / F-major pentatonic arpeggio notes (Hz)
const ARP_NOTES_HZ = [
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  523.25, // C5
  783.99, // G5
  659.25, // E5
  587.33, // D5
];

// Subtle 16-step pattern: null = rest, number = index into ARP_NOTES_HZ
const ARP_PATTERN: (number | null)[] = [
  0, null, 1, 2,
  null, 3, null, 4,
  5, null, 6, null,
  7, null, 1, null,
];

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let stepTimerId: ReturnType<typeof setInterval> | null = null;
let isGrooveDesired = false;
let isSchedulerRunning = false;
let currentStep = 0;
let listenersAttached = false;

export function isArcadeMusicEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(ARCADE_MUSIC_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function setArcadeMusicEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ARCADE_MUSIC_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // Ignore storage quota / private mode errors
  }

  if (!enabled) {
    stopArcadeGroove();
  }
}

export function isArcadeGroovePlaying(): boolean {
  return isSchedulerRunning;
}

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx && audioCtx.state !== 'closed') {
    return audioCtx;
  }

  const win = window as WebAudioWindow;
  const Ctor = win.AudioContext || win.webkitAudioContext;
  if (!Ctor) return null;

  try {
    audioCtx = new Ctor();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.09, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  } catch {
    audioCtx = null;
    masterGain = null;
    return null;
  }
}

function scheduleBassNote(ctx: AudioContext, dest: AudioNode, freqHz: number, accent: number): void {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqHz, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(290, now);
    filter.Q.setValueAtTime(0.9, now);

    const peak = 0.85 * accent;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(filter);
    filter.connect(env);
    env.connect(dest);

    osc.start(now);
    osc.stop(now + 0.26);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        env.disconnect();
      } catch {
        // Safe cleanup
      }
    };
  } catch {
    // Ignore transient Web Audio scheduling errors
  }
}

function scheduleArpNote(ctx: AudioContext, dest: AudioNode, freqHz: number): void {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqHz, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1450, now);
    filter.Q.setValueAtTime(0.7, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.55, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(filter);
    filter.connect(env);
    env.connect(dest);

    osc.start(now);
    osc.stop(now + 0.18);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        env.disconnect();
      } catch {
        // Safe cleanup
      }
    };
  } catch {
    // Ignore transient Web Audio scheduling errors
  }
}

function runGrooveTick(): void {
  if (!isGrooveDesired || !isArcadeMusicEnabled()) {
    stopSchedulerOnly();
    return;
  }
  if (typeof document !== 'undefined' && document.hidden) {
    stopSchedulerOnly();
    return;
  }

  const ctx = audioCtx;
  const out = masterGain;
  if (!ctx || !out || ctx.state !== 'running') {
    return;
  }

  const stepInBar = currentStep % 16;
  const barIndex = Math.floor(currentStep / 16) % BASS_ROOTS_HZ.length;
  const bassHz = BASS_ROOTS_HZ[barIndex];

  // Soft bass pulse on steps 0, 6, 8, 14 (modern syncopated chill-electro pulse)
  if (stepInBar === 0) {
    scheduleBassNote(ctx, out, bassHz, 1.0);
  } else if (stepInBar === 6 || stepInBar === 14) {
    scheduleBassNote(ctx, out, bassHz * 1.5, 0.58);
  } else if (stepInBar === 8) {
    scheduleBassNote(ctx, out, bassHz, 0.82);
  }

  const arpIdx = ARP_PATTERN[stepInBar];
  if (arpIdx !== null && ARP_NOTES_HZ[arpIdx]) {
    scheduleArpNote(ctx, out, ARP_NOTES_HZ[arpIdx]);
  }

  currentStep = (currentStep + 1) % (16 * BASS_ROOTS_HZ.length);
}

function stopSchedulerOnly(): void {
  if (stepTimerId !== null) {
    globalThis.clearInterval(stepTimerId);
    stepTimerId = null;
  }
  isSchedulerRunning = false;
}

function startSchedulerOnly(): void {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;
  stepTimerId = globalThis.setInterval(runGrooveTick, SIXTEENTH_MS);
}

function handleVisibilityOrBlur(): void {
  if (typeof document !== 'undefined' && document.hidden) {
    stopSchedulerOnly();
    if (audioCtx && audioCtx.state === 'running') {
      void audioCtx.suspend().catch(() => {});
    }
    return;
  }

  if (isGrooveDesired && isArcadeMusicEnabled() && typeof document !== 'undefined' && !document.hidden) {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    startSchedulerOnly();
  }
}

function handleWindowPageHideOrBlur(): void {
  stopSchedulerOnly();
  if (audioCtx && audioCtx.state === 'running') {
    void audioCtx.suspend().catch(() => {});
  }
}

function handleWindowFocus(): void {
  if (isGrooveDesired && isArcadeMusicEnabled() && typeof document !== 'undefined' && !document.hidden) {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    startSchedulerOnly();
  }
}

function attachLifecycleListeners(): void {
  if (listenersAttached || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  listenersAttached = true;
  document.addEventListener('visibilitychange', handleVisibilityOrBlur);
  window.addEventListener('pagehide', handleWindowPageHideOrBlur);
  window.addEventListener('blur', handleWindowPageHideOrBlur);
  window.addEventListener('focus', handleWindowFocus);
}

function detachLifecycleListeners(): void {
  if (!listenersAttached || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  listenersAttached = false;
  document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
  window.removeEventListener('pagehide', handleWindowPageHideOrBlur);
  window.removeEventListener('blur', handleWindowPageHideOrBlur);
  window.removeEventListener('focus', handleWindowFocus);
}

/**
 * Starts or resumes the rhythmic arcade groove when music is enabled.
 * Safe to call on mount AND on user tap gestures (unlocks iOS/Android Web Audio).
 */
export function startArcadeGroove(): void {
  if (!isArcadeMusicEnabled()) {
    stopArcadeGroove();
    return;
  }

  isGrooveDesired = true;
  attachLifecycleListeners();

  if (typeof document !== 'undefined' && document.hidden) {
    return;
  }

  const ctx = getOrCreateAudioContext();
  if (ctx) {
    if (masterGain) {
      masterGain.gain.setValueAtTime(0.09, ctx.currentTime);
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  startSchedulerOnly();
}

/**
 * Plays a crystalline, non-intrusive micro-chord when the student matches a pair.
 * Respects `isArcadeMusicEnabled()` strictly.
 */
export function playArcadeMatchChime(): void {
  if (!isArcadeMusicEnabled()) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  const ctx = getOrCreateAudioContext();
  const out = masterGain;
  if (!ctx || !out) return;

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  // Luminous Fmaj9 triad sparkle: A5 (880Hz) -> C6 (1046.5Hz) -> E6 (1318.5Hz)
  const chordHz = [880.0, 1046.5, 1318.51];
  const baseTime = ctx.currentTime;

  chordHz.forEach((freq, idx) => {
    try {
      const startAt = baseTime + idx * 0.026;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startAt);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, startAt);

      env.gain.setValueAtTime(0.0001, startAt);
      env.gain.linearRampToValueAtTime(0.48 - idx * 0.08, startAt + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);

      osc.connect(filter);
      filter.connect(env);
      env.connect(out);

      osc.start(startAt);
      osc.stop(startAt + 0.24);
      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          env.disconnect();
        } catch {
          // Safe cleanup
        }
      };
    } catch {
      // Safe fallback
    }
  });
}

/**
 * Immediately halts all groove timers, attenuates master output, suspends AudioContext,
 * and removes global listeners so zero background CPU/audio remains after leaving the game.
 */
export function stopArcadeGroove(): void {
  isGrooveDesired = false;
  currentStep = 0;
  stopSchedulerOnly();
  detachLifecycleListeners();

  if (audioCtx && masterGain && audioCtx.state === 'running') {
    try {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(0.0001, now);
      void audioCtx.suspend().catch(() => {});
    } catch {
      // Ignore context state race
    }
  }
}
