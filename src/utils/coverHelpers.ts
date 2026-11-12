export const MAX_CUSTOM_PHOTO_DATA_URL_LENGTH = 950_000;

/**
 * Checks whether the URL search string requests skipping the cover screen (?autostart=1 or ?study=1).
 */
export function shouldSkipCoverFromSearch(search: string): boolean {
  if (!search) return false;
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const val = params.get('autostart') || params.get('study');
  return val === '1' || val === 'true';
}

/**
 * Checks whether the URL search string requests opening the mobile Download modal (?download=1).
 */
export function shouldOpenDownloadFromSearch(search: string): boolean {
  if (!search) return false;
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const val = params.get('download');
  return val === '1' || val === 'true';
}

/**
 * Formats a friendly first-name greeting for logged-in students on the cover/login view.
 */
export function formatStudentFirstName(
  displayName?: string | null,
  email?: string | null
): string {
  const trimmedName = (displayName || '').trim();
  if (trimmedName.length > 0) {
    return trimmedName.split(/\s+/)[0];
  }
  const trimmedEmail = (email || '').trim();
  if (trimmedEmail.includes('@')) {
    const localPart = trimmedEmail.split('@')[0].trim();
    if (localPart.length > 0) return localPart;
  }
  return 'aluno(a)';
}

/**
 * Validates that a persisted custom portrait value is a safe, bounded image data URL.
 */
export function isValidCustomPhotoDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < 32 || value.length > MAX_CUSTOM_PHOTO_DATA_URL_LENGTH) {
    return false;
  }
  return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value);
}

export interface UserProgressMetrics {
  total: number;
  mastered: number;
  review: number;
  unseen: number;
  masteredPercentage: number;
  reviewPercentage: number;
  unseenPercentage: number;
}

/**
 * Calculates user cards progress counts and integer percentages for the donut chart.
 */
export function computeProgressMetrics(
  totalCards: number,
  masteredCount: number,
  reviewCount: number,
  unseenCount?: number
): UserProgressMetrics {
  const total = Math.max(0, totalCards);
  const mastered = Math.min(total, Math.max(0, masteredCount));
  const review = Math.min(total - mastered, Math.max(0, reviewCount));
  const unseen =
    unseenCount !== undefined
      ? Math.max(0, unseenCount)
      : Math.max(0, total - mastered - review);

  const safeTotal = total > 0 ? total : 1;
  const masteredPercentage = total > 0 ? Math.round((mastered / safeTotal) * 100) : 0;
  const reviewPercentage = total > 0 ? Math.round((review / safeTotal) * 100) : 0;
  const unseenPercentage =
    total > 0 ? Math.max(0, 100 - masteredPercentage - reviewPercentage) : 100;

  return {
    total,
    mastered,
    review,
    unseen,
    masteredPercentage,
    reviewPercentage,
    unseenPercentage,
  };
}
