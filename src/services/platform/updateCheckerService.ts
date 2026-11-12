import { Capacitor } from '@capacitor/core';
import {
  APP_VERSION,
  OFFICIAL_ANDROID_APK_URL,
  OFFICIAL_LATEST_RELEASE_API_URL,
  OFFICIAL_LATEST_RELEASE_PAGE_URL,
} from '../../config/appReleaseConfig';

const DISMISSED_RELEASE_TAG_KEY = 'ewm_dismissed_release_tag_v1';
const LAST_RELEASE_CHECK_TS_KEY = 'ewm_last_release_check_ts_v1';
const cachedLatestInfoKey = 'ewm_cached_latest_release_v1';
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes throttle

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  publishedAt: string | null;
  apkDownloadUrl: string;
  releasePageUrl: string;
}

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubLatestReleasePayload {
  tag_name?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubReleaseAsset[];
}

function parseSemverParts(rawVersion: string): [number, number, number] | null {
  const cleaned = rawVersion.trim().replace(/^v/i, '').split('-')[0];
  const parts = cleaned.split('.');
  if (parts.length < 2) return null;
  const major = Number.parseInt(parts[0] || '0', 10);
  const minor = Number.parseInt(parts[1] || '0', 10);
  const patch = Number.parseInt(parts[2] || '0', 10);
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }
  return [major, minor, patch];
}

export function isNewerSemver(candidateVersion: string, currentVersion: string): boolean {
  const candidate = parseSemverParts(candidateVersion);
  const current = parseSemverParts(currentVersion);
  if (!candidate || !current) return false;

  for (let i = 0; i < 3; i += 1) {
    if (candidate[i] > current[i]) return true;
    if (candidate[i] < current[i]) return false;
  }
  return false;
}

export function dismissReleaseUpdateTag(tagName: string): void {
  try {
    localStorage.setItem(DISMISSED_RELEASE_TAG_KEY, tagName);
  } catch {
    // ignore storage errors
  }
}

function getDismissedReleaseTag(): string | null {
  try {
    return localStorage.getItem(DISMISSED_RELEASE_TAG_KEY);
  } catch {
    return null;
  }
}

/**
 * Queries the official Organization GitHub Releases API to check if a newer app version
 * (`vX.Y.Z`) has been published. Silently returns `null` when offline or on any network error.
 */
export async function checkForAppReleaseUpdate(force = false): Promise<AppUpdateInfo | null> {
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    if (!force) {
      const lastTsRaw = sessionStorage.getItem(LAST_RELEASE_CHECK_TS_KEY);
      const lastTs = lastTsRaw ? Number.parseInt(lastTsRaw, 10) : 0;
      if (lastTs > 0 && Date.now() - lastTs < MIN_CHECK_INTERVAL_MS) {
        const cachedRaw = sessionStorage.getItem(cachedLatestInfoKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as AppUpdateInfo;
          if (
            isNewerSemver(parsed.latestVersion, APP_VERSION) &&
            getDismissedReleaseTag() !== parsed.tagName
          ) {
            return parsed;
          }
        }
        return null;
      }
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6500);

    const response = await fetch(OFFICIAL_LATEST_RELEASE_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    window.clearTimeout(timeoutId);
    sessionStorage.setItem(LAST_RELEASE_CHECK_TS_KEY, String(Date.now()));

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GitHubLatestReleasePayload;
    if (!payload || payload.draft || payload.prerelease || !payload.tag_name) {
      return null;
    }

    const tagName = payload.tag_name.trim();
    const normalizedLatest = tagName.replace(/^v/i, '');

    if (!isNewerSemver(normalizedLatest, APP_VERSION)) {
      sessionStorage.removeItem(cachedLatestInfoKey);
      return null;
    }

    const apkAsset = payload.assets?.find(
      (a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk')
    );

    const info: AppUpdateInfo = {
      currentVersion: APP_VERSION,
      latestVersion: normalizedLatest,
      tagName,
      publishedAt: payload.published_at || null,
      apkDownloadUrl: apkAsset?.browser_download_url || OFFICIAL_ANDROID_APK_URL,
      releasePageUrl: payload.html_url || OFFICIAL_LATEST_RELEASE_PAGE_URL,
    };

    sessionStorage.setItem(cachedLatestInfoKey, JSON.stringify(info));

    if (!force && getDismissedReleaseTag() === tagName) {
      return null;
    }

    return info;
  } catch {
    // Offline or GitHub API unreachable — fail silently
    return null;
  }
}

/**
 * Performs a 1-click update tailored to the current runtime platform:
 * - Native Android APK: launches direct download of the signed EWM-Keep-Practicing.apk
 * - Web / PWA: flushes Service Worker shell caches and reloads into the newest deployment
 */
export async function applyOneClickAppUpdate(update: AppUpdateInfo): Promise<void> {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    window.open(update.apkDownloadUrl, '_system');
    return;
  }

  if (platform === 'ios') {
    window.open(update.releasePageUrl, '_system');
    return;
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((reg) => reg.update()));
    }
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.allSettled(
        cacheKeys
          .filter((key) => key.startsWith('ewm-hybrid-'))
          .map((key) => caches.delete(key))
      );
    }
  } catch {
    // ignore cache flush errors
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('updated', update.latestVersion);
  window.location.replace(nextUrl.toString());
}
