import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

const REMINDER_STORAGE_KEY = 'ewm_v6_daily_study_reminder';
const LAST_WEB_FIRED_DATE_KEY = 'ewm_v6_reminder_last_fired_date';
const DAILY_REMINDER_NOTIFICATION_ID = 4201;

export type NotificationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface StudyReminderConfig {
  enabled: boolean;
  hour: number; // 0-23
  minute: number; // 0-59
  message: string;
  updatedAt: string;
}

const DEFAULT_REMINDER_MESSAGE =
  'Hora de praticar suas expressões! 5 minutinhos de áudio US & UK mantêm sua fluência afiada.';

export function getDefaultReminderConfig(): StudyReminderConfig {
  return {
    enabled: false,
    hour: 19,
    minute: 30,
    message: DEFAULT_REMINDER_MESSAGE,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeReminderConfig(raw: Partial<StudyReminderConfig> | null | undefined): StudyReminderConfig {
  const fallback = getDefaultReminderConfig();
  if (!raw || typeof raw !== 'object') return fallback;
  const hour =
    typeof raw.hour === 'number' && Number.isFinite(raw.hour)
      ? Math.max(0, Math.min(23, Math.floor(raw.hour)))
      : fallback.hour;
  const minute =
    typeof raw.minute === 'number' && Number.isFinite(raw.minute)
      ? Math.max(0, Math.min(59, Math.floor(raw.minute)))
      : fallback.minute;
  const message =
    typeof raw.message === 'string' && raw.message.trim().length > 0
      ? raw.message.trim().slice(0, 180)
      : DEFAULT_REMINDER_MESSAGE;

  return {
    enabled: Boolean(raw.enabled),
    hour,
    minute,
    message,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export async function loadStudyReminderConfig(): Promise<StudyReminderConfig> {
  try {
    const { value } = await Preferences.get({ key: REMINDER_STORAGE_KEY });
    if (value) {
      return sanitizeReminderConfig(JSON.parse(value) as Partial<StudyReminderConfig>);
    }
  } catch {
    // fallback to localStorage if needed
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
      if (raw) {
        return sanitizeReminderConfig(JSON.parse(raw) as Partial<StudyReminderConfig>);
      }
    } catch {
      // ignore
    }
  }

  return getDefaultReminderConfig();
}

async function persistReminderConfig(config: StudyReminderConfig): Promise<void> {
  const serialized = JSON.stringify(config);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
  }
  try {
    await Preferences.set({ key: REMINDER_STORAGE_KEY, value: serialized });
  } catch {
    // ignore
  }
}

export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

/**
 * Requests notification permission ONLY when explicitly initiated by the student.
 */
export async function requestStudyNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') return 'granted';
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display === 'granted') return 'granted';
      if (requested.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') return 'granted';
    if (result === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Configures or cancels the student's daily study reminder across Native Mobile and Web.
 * Requests OS/browser permission smoothly only when enabling.
 */
export async function configureDailyStudyReminder(input: {
  enabled: boolean;
  hour: number;
  minute: number;
  message?: string;
}): Promise<{
  ok: boolean;
  permission: NotificationPermissionStatus;
  config: StudyReminderConfig;
  errorMessage?: string;
}> {
  const candidate = sanitizeReminderConfig({
    ...input,
    updatedAt: new Date().toISOString(),
  });

  if (!candidate.enabled) {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
        });
      } catch {
        // ignore
      }
    }
    await persistReminderConfig(candidate);
    const perm = await checkNotificationPermission();
    return { ok: true, permission: perm, config: candidate };
  }

  const permission = await requestStudyNotificationPermission();
  if (permission !== 'granted') {
    const disabledConfig: StudyReminderConfig = { ...candidate, enabled: false };
    await persistReminderConfig(disabledConfig);
    return {
      ok: false,
      permission,
      config: disabledConfig,
      errorMessage:
        permission === 'unsupported'
          ? 'Notificações não são suportadas neste ambiente.'
          : 'Permissão de notificação não concedida. Ative nas configurações do dispositivo/navegador.',
    };
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
      }).catch(() => {});

      await LocalNotifications.schedule({
        notifications: [
          {
            id: DAILY_REMINDER_NOTIFICATION_ID,
            title: 'EWM · Keep practicing',
            body: candidate.message,
            schedule: {
              on: {
                hour: candidate.hour,
                minute: candidate.minute,
              },
              repeats: true,
              allowWhileIdle: true,
            },
            extra: {
              source: 'daily-study-reminder',
            },
          },
        ],
      });
    } catch {
      return {
        ok: false,
        permission,
        config: { ...candidate, enabled: false },
        errorMessage: 'Não foi possível agendar o lembrete nativo no dispositivo.',
      };
    }
  }

  await persistReminderConfig(candidate);
  return { ok: true, permission, config: candidate };
}

function getTodayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Starts a lightweight Web Notification watcher for PC/Browser users who enabled daily reminders.
 * On Native Mobile, OS-level `LocalNotifications.schedule` handles background delivery natively.
 */
export function startWebStudyReminderWatcher(): () => void {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined' || !('Notification' in window)) {
    return () => {};
  }

  const checkAndNotify = async () => {
    if (Notification.permission !== 'granted') return;
    const cfg = await loadStudyReminderConfig();
    if (!cfg.enabled) return;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = cfg.hour * 60 + cfg.minute;

    // Fire within a 15-minute window after scheduled time, at most once per calendar day
    if (nowMinutes >= targetMinutes && nowMinutes <= targetMinutes + 15) {
      const today = getTodayKey(now);
      let lastFired = '';
      try {
        lastFired = window.localStorage.getItem(LAST_WEB_FIRED_DATE_KEY) || '';
      } catch {
        // ignore
      }
      if (lastFired === today) return;

      try {
        window.localStorage.setItem(LAST_WEB_FIRED_DATE_KEY, today);
        new Notification('EWM · Keep practicing', {
          body: cfg.message,
          icon: '/pwa-192x192.png',
          badge: '/favicon-32x32.png',
          tag: 'ewm-daily-study-reminder',
        });
      } catch {
        // ignore browser notification restrictions
      }
    }
  };

  const timer = window.setInterval(() => {
    void checkAndNotify();
  }, 45000);

  return () => {
    window.clearInterval(timer);
  };
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
