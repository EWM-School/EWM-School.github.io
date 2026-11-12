import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

export interface NetworkSnapshot {
  connected: boolean;
  connectionType: string;
  checkedAt: string;
}

type NetworkStatusListener = (snapshot: NetworkSnapshot) => void;

const listeners = new Set<NetworkStatusListener>();

let currentSnapshot: NetworkSnapshot = {
  connected: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  connectionType: 'unknown',
  checkedAt: new Date().toISOString(),
};

let initialized = false;

function emitSnapshot(next: NetworkSnapshot): void {
  const changed =
    next.connected !== currentSnapshot.connected ||
    next.connectionType !== currentSnapshot.connectionType;
  currentSnapshot = next;
  if (changed) {
    listeners.forEach((listener) => {
      try {
        listener(currentSnapshot);
      } catch {
        // ignore listener exceptions
      }
    });
  }
}

export function initNetworkMonitor(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Browser online/offline events (works on PC and WebView as immediate signal)
  const onBrowserOnline = () => {
    emitSnapshot({
      connected: true,
      connectionType: currentSnapshot.connectionType === 'none' ? 'wifi' : currentSnapshot.connectionType,
      checkedAt: new Date().toISOString(),
    });
    // Verify via Capacitor Network plugin if available
    void refreshNetworkStatus();
  };

  const onBrowserOffline = () => {
    emitSnapshot({
      connected: false,
      connectionType: 'none',
      checkedAt: new Date().toISOString(),
    });
  };

  window.addEventListener('online', onBrowserOnline);
  window.addEventListener('offline', onBrowserOffline);

  // Capacitor Network plugin listener (authoritative on Android/iOS and supported on Web)
  void Network.getStatus()
    .then((status) => {
      emitSnapshot({
        connected: Boolean(status.connected),
        connectionType: status.connectionType || (status.connected ? 'wifi' : 'none'),
        checkedAt: new Date().toISOString(),
      });
    })
    .catch(() => {
      // keep navigator.onLine fallback
    });

  if (Capacitor.isNativePlatform()) {
    void Network.addListener('networkStatusChange', (status) => {
      emitSnapshot({
        connected: Boolean(status.connected),
        connectionType: status.connectionType || (status.connected ? 'wifi' : 'none'),
        checkedAt: new Date().toISOString(),
      });
    }).catch(() => {});
  }
}

export async function refreshNetworkStatus(): Promise<NetworkSnapshot> {
  try {
    const status = await Network.getStatus();
    const next: NetworkSnapshot = {
      connected: Boolean(status.connected),
      connectionType: status.connectionType || (status.connected ? 'wifi' : 'none'),
      checkedAt: new Date().toISOString(),
    };
    emitSnapshot(next);
    return next;
  } catch {
    const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const next: NetworkSnapshot = {
      connected: online,
      connectionType: online ? 'unknown' : 'none',
      checkedAt: new Date().toISOString(),
    };
    emitSnapshot(next);
    return next;
  }
}

export function getNetworkSnapshot(): NetworkSnapshot {
  initNetworkMonitor();
  return currentSnapshot;
}

export function isDeviceOnline(): boolean {
  return getNetworkSnapshot().connected;
}

export function subscribeNetworkStatus(listener: NetworkStatusListener): () => void {
  initNetworkMonitor();
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
  };
}
