import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

const HAPTICS_PREF_KEY = 'ewm_v6_haptics_enabled';

let hapticsEnabled = loadInitialHapticsFlag();

function loadInitialHapticsFlag(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(HAPTICS_PREF_KEY);
    if (raw === 'false') return false;
  } catch {
    // ignore
  }
  return true;
}

// Hydrate asynchronously from Capacitor Preferences on boot
if (typeof window !== 'undefined') {
  void Preferences.get({ key: HAPTICS_PREF_KEY })
    .then(({ value }) => {
      if (value === 'false') hapticsEnabled = false;
      else if (value === 'true') hapticsEnabled = true;
    })
    .catch(() => {});
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  hapticsEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HAPTICS_PREF_KEY, String(enabled));
    } catch {
      // ignore
    }
  }
  try {
    await Preferences.set({ key: HAPTICS_PREF_KEY, value: String(enabled) });
  } catch {
    // ignore
  }
}

function tryWebMobileVibrate(pattern: number | number[]): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  // Avoid desktop browser console interventions; only vibrate on mobile touch web browsers that support it
  const isTouchDevice = navigator.maxTouchPoints > 0 && /android/i.test(navigator.userAgent || '');
  if (!isTouchDevice || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore silently on PC / unsupported browsers
  }
}

/**
 * Gamified tactile feedback for Quiz correct answers and mastered flashcards.
 */
export async function triggerSuccess(): Promise<void> {
  if (!hapticsEnabled) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    } catch {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // ignore
      }
      return;
    }
  }
  tryWebMobileVibrate(18);
}

/**
 * Tactile feedback for Quiz wrong answers or validation warnings.
 */
export async function triggerError(): Promise<void> {
  if (!hapticsEnabled) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Error });
      return;
    } catch {
      // ignore
    }
    return;
  }
  tryWebMobileVibrate([20, 40, 25]);
}

/**
 * Subtle selection tick when flipping a 3D flashcard or switching study cards.
 */
export async function triggerFlip(): Promise<void> {
  if (!hapticsEnabled) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.selectionChanged();
      return;
    } catch {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // ignore
      }
      return;
    }
  }
  tryWebMobileVibrate(8);
}

/**
 * Light impact for primary mobile navigation taps.
 */
export async function triggerTap(): Promise<void> {
  if (!hapticsEnabled) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // ignore
    }
  }
}
