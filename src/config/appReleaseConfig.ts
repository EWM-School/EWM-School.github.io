declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.trim().length > 0
    ? __APP_VERSION__.trim()
    : '1.2.0';

export const OFFICIAL_GITHUB_ORG = 'EWM-School';
export const OFFICIAL_GITHUB_REPO = 'EWM-School.github.io';

export const OFFICIAL_CANONICAL_WEB_URL = 'https://ewm-school.github.io/';

export const OFFICIAL_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${OFFICIAL_GITHUB_ORG}/${OFFICIAL_GITHUB_REPO}/releases/latest`;

export const OFFICIAL_LATEST_RELEASE_PAGE_URL = `https://github.com/${OFFICIAL_GITHUB_ORG}/${OFFICIAL_GITHUB_REPO}/releases/latest`;

export const OFFICIAL_ANDROID_APK_URL = `https://github.com/${OFFICIAL_GITHUB_ORG}/${OFFICIAL_GITHUB_REPO}/releases/latest/download/EWM-Keep-Practicing.apk`;

export const OFFICIAL_ANDROID_AAB_URL = `https://github.com/${OFFICIAL_GITHUB_ORG}/${OFFICIAL_GITHUB_REPO}/releases/latest/download/EWM-Keep-Practicing.aab`;

/**
 * Dynamically resolves the active public web origin + pathname for client-side QR Code
 * generation (falling back to https://ewm-school.github.io/ only when running inside a
 * local dev server or native Capacitor WebView).
 */
export function resolveDynamicMobileDownloadUrl(): string {
  if (typeof window === 'undefined') {
    return `${OFFICIAL_CANONICAL_WEB_URL}?download=1`;
  }

  const { protocol, hostname, origin, pathname } = window.location;
  const isLocalOrNativeWebView =
    protocol !== 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  if (isLocalOrNativeWebView) {
    return `${OFFICIAL_CANONICAL_WEB_URL}?download=1`;
  }

  const normalizedPath = pathname.endsWith('/')
    ? pathname
    : pathname.replace(/\/index\.html$/i, '/');

  return `${origin}${normalizedPath}?download=1`;
}
