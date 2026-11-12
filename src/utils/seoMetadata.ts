export interface IncomingHeadersLike {
  [key: string]: string | string[] | undefined;
}

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return (value[0] || '').split(',')[0].trim();
  }
  if (typeof value === 'string') {
    return value.split(',')[0].trim();
  }
  return '';
}

function normalizeOriginUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith('.run.app') && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

/**
 * Resolves the public origin (scheme + host) for OpenGraph, Twitter Card, and Canonical URLs.
 * Social crawlers (WhatsApp, Telegram, LinkedIn, X, Discord, iMessage) require full absolute HTTPS URLs
 * and do not execute client-side JavaScript.
 */
export function resolvePublicOrigin(
  headers: IncomingHeadersLike,
  envAppUrl?: string
): string {
  const forwardedHost = readHeaderValue(headers['x-forwarded-host']);
  const host = forwardedHost || readHeaderValue(headers['host']);
  const forwardedProto = readHeaderValue(headers['x-forwarded-proto']).toLowerCase();

  const isLocalHost =
    !host ||
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('0.0.0.0');

  if (!isLocalHost) {
    const isCloudRunOrPublic =
      host.endsWith('.run.app') ||
      forwardedProto === 'https' ||
      (!host.includes(':') && host.includes('.'));
    const scheme = isCloudRunOrPublic ? 'https' : forwardedProto || 'http';
    const candidate = normalizeOriginUrl(`${scheme}://${host}`);
    if (candidate) return candidate;
  }

  if (envAppUrl) {
    const envOrigin = normalizeOriginUrl(envAppUrl);
    if (envOrigin) return envOrigin;
  }

  if (host) {
    const scheme = forwardedProto === 'https' ? 'https' : 'http';
    const fallback = normalizeOriginUrl(`${scheme}://${host}`);
    if (fallback) return fallback;
  }

  return 'http://localhost:3000';
}

function normalizePathname(rawPath: string): string {
  if (!rawPath || rawPath === '/index.html') return '/';
  const clean = rawPath.split('?')[0].split('#')[0].trim();
  if (!clean.startsWith('/')) return `/${clean}`;
  return clean;
}

/**
 * Rewrites relative OpenGraph, Twitter Card, Canonical, and JSON-LD image/URL fields in index.html
 * into full absolute URLs matching the resolved public origin.
 */
export function injectAbsoluteSocialMetadata(
  html: string,
  origin: string,
  requestPath = '/'
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = normalizePathname(requestPath);
  const canonicalUrl = cleanPath === '/' ? `${cleanOrigin}/` : `${cleanOrigin}${cleanPath}`;
  const ogCoverUrl = `${cleanOrigin}/og-ewm-cover-1200x630.png`;
  const attachedSquareUrl = `${cleanOrigin}/assets/aistudio/WhatsApp_Image_2026-11-07_at_17.55.16_2916485b.jpeg`;

  return html
    .replace(
      /<!--\s*EWM_CANONICAL_LINK\s*-->/i,
      `<link rel="canonical" href="${canonicalUrl}" />`
    )
    .replace(
      /(<link\s+rel="canonical"\s+href=")([^"]*)(")/i,
      `$1${canonicalUrl}$3`
    )
    .replace(
      /(<meta\s+property="og:url"\s+content=")([^"]*)(")/i,
      `$1${canonicalUrl}$3`
    )
    .replace(
      /(<meta\s+property="og:image"\s+content=")\/og-ewm-cover-1200x630\.png(")/gi,
      `$1${ogCoverUrl}$2`
    )
    .replace(
      /(<meta\s+property="og:image:secure_url"\s+content=")\/og-ewm-cover-1200x630\.png(")/gi,
      `$1${ogCoverUrl}$2`
    )
    .replace(
      /(<meta\s+property="og:image"\s+content=")\/assets\/aistudio\/WhatsApp_Image_2026-11-07_at_17\.55\.16_2916485b\.jpeg(")/gi,
      `$1${attachedSquareUrl}$2`
    )
    .replace(
      /(<meta\s+name="twitter:image"\s+content=")\/og-ewm-cover-1200x630\.png(")/gi,
      `$1${ogCoverUrl}$2`
    )
    .replace(
      /(<link\s+itemprop="thumbnailUrl"\s+href=")\/og-ewm-cover-1200x630\.png(")/gi,
      `$1${ogCoverUrl}$2`
    )
    .replace(
      /"url":\s*"\/"/g,
      `"url": "${canonicalUrl}"`
    )
    .replace(
      /"image":\s*"\/og-ewm-cover-1200x630\.png"/g,
      `"image": "${ogCoverUrl}"`
    );
}
