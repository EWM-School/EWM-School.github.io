import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export type HybridPlatform = 'ios' | 'android' | 'web';

/**
 * Returns true strictly when running inside a native Capacitor container (Android or iOS).
 */
export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Returns the active platform identifier ('ios' | 'android' | 'web').
 */
export function getHybridPlatform(): HybridPlatform {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') return p;
    return 'web';
  } catch {
    return 'web';
  }
}

export interface NativeLifecycleHandlers {
  /**
   * Return `true` if the in-app navigation handled the back gesture
   * (e.g., closed an open modal, exited Focus Mode, or returned to Study tab).
   */
  onBackButton?: () => boolean;
  /**
   * Fired whenever the app returns to the foreground (native resume or browser tab visible).
   */
  onAppForeground?: () => void;
  /**
   * Fired when an Android App Link / iOS Universal Link (`https://ewm-school.github.io/...`)
   * opens or resumes the native app.
   */
  onDeepLinkUrl?: (url: string) => void;
}

/**
 * Unified lifecycle bridge for Android hardware back button, App Links (`appUrlOpen`),
 * and foreground resume events, with clean browser fallback via `visibilitychange`.
 */
export function registerHybridLifecycleListeners(
  handlers: NativeLifecycleHandlers
): () => void {
  const cleanups: Array<() => void> = [];

  if (isNativeMobile()) {
    let active = true;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!active) return;
      const consumed = handlers.onBackButton?.() ?? false;
      if (!consumed) {
        if (canGoBack && typeof window !== 'undefined' && window.history.length > 1) {
          window.history.back();
        } else {
          void CapacitorApp.minimizeApp().catch(() => {});
        }
      }
    })
      .then((handle) => {
        if (!active) {
          void handle.remove();
        } else {
          cleanups.push(() => {
            void handle.remove();
          });
        }
      })
      .catch(() => {});

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!active) return;
      if (isActive) {
        handlers.onAppForeground?.();
      }
    })
      .then((handle) => {
        if (!active) {
          void handle.remove();
        } else {
          cleanups.push(() => {
            void handle.remove();
          });
        }
      })
      .catch(() => {});

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (!active || !url) return;
      handlers.onDeepLinkUrl?.(url);
    })
      .then((handle) => {
        if (!active) {
          void handle.remove();
        } else {
          cleanups.push(() => {
            void handle.remove();
          });
        }
      })
      .catch(() => {});

    void CapacitorApp.getLaunchUrl()
      .then((launch) => {
        if (active && launch?.url) {
          handlers.onDeepLinkUrl?.(launch.url);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      cleanups.forEach((fn) => fn());
    };
  }

  if (typeof document !== 'undefined') {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handlers.onAppForeground?.();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
