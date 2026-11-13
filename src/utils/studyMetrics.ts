export interface StudentLeaderboardEntry {
  id: string;
  name: string;
  shortName: string;
  avatarUrl?: string;
  initials: string;
  isCurrentUser?: boolean;
  cardsReviewed: number;
  masteredCount?: number;
  reviewCount?: number;
  quizScore?: number;
  activeDays: number;
  studyTimeMinutes: number; // total monthly study minutes
  minutosEstudados: number; // daily study minutes (metadados do ranking)
  score: number; // total real points in ranking
  rank: number;
  badgeEmoji: string;
  statusText: string;
  isOnline: boolean;
}

export interface CloudLeaderboardRecord {
  uid: string;
  name: string;
  shortName: string;
  initials: string;
  avatarUrl?: string;
  monthKey: string; // YYYY-MM
  score: number;
  cardsReviewed: number;
  masteredCount: number;
  reviewCount: number;
  quizScore: number;
  activeDays: number;
  studyTimeMinutes: number;
  minutosEstudados: number;
  statusText: string;
  updatedAtMs: number;
}

export interface UserStudyStats {
  dailyGoal: number;
  todayDate: string; // YYYY-MM-DD
  todayReviewedCardIds: string[];
  monthlyReviewedCardIds?: string[]; // unique cards practiced in current month
  todayStudyMinutes: number; // daily study minutes
  minutosEstudados?: number; // alias for daily study minutes
  monthlyActiveDays: string[]; // YYYY-MM-DD
  monthlyStudyMinutes: number;
  currentMonthKey: string; // YYYY-MM
  lastActiveTimestamp: number;
  todayDiscoveryDate?: string; // YYYY-MM-DD anti-farming cap window
  todayDiscoveryKeys?: string[]; // canonical keys rewarded today (max 5/day)
  monthlyDiscoveryBonusXp?: number; // accumulated +2 XP discovery bonuses in current month
  todaySpeakingDate?: string; // YYYY-MM-DD anti-farming window for pronunciation practice
  todaySpeakingPhraseRewards?: Record<string, number>; // phraseKey -> max XP rewarded today (3 or 5)
  monthlySpeakingXp?: number; // accumulated legitimate speaking XP in current month
}

export const DISCOVERY_BONUS_XP = 2;
export const MAX_DAILY_DISCOVERY_BONUSES = 5;
export const SPEAKING_NATIVE_XP = 5;
export const SPEAKING_POLISH_XP = 3;
export const MAX_DAILY_SPEAKING_XP = 75;

const STORAGE_KEY = 'ewm_v5_study_metrics';
const LEADERBOARD_CACHE_KEY = 'ewm_v6_leaderboard_cache';

export function getTodayDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDefaultStudyStats(d = new Date()): UserStudyStats {
  return {
    dailyGoal: 15,
    todayDate: getTodayDateString(d),
    todayReviewedCardIds: [],
    monthlyReviewedCardIds: [],
    todayStudyMinutes: 0,
    minutosEstudados: 0,
    monthlyActiveDays: [],
    monthlyStudyMinutes: 0,
    currentMonthKey: getCurrentMonthKey(d),
    lastActiveTimestamp: d.getTime(),
    todayDiscoveryDate: getTodayDateString(d),
    todayDiscoveryKeys: [],
    monthlyDiscoveryBonusXp: 0,
    todaySpeakingDate: getTodayDateString(d),
    todaySpeakingPhraseRewards: {},
    monthlySpeakingXp: 0,
  };
}

export function loadUserStudyStats(): UserStudyStats {
  if (typeof window === 'undefined') return getDefaultStudyStats();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const today = getTodayDateString();
    const currentMonth = getCurrentMonthKey();

    if (!raw) {
      const initial = getDefaultStudyStats();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw) as Partial<UserStudyStats>;
    const parsedTodayMinutes =
      parsed.todayDate === today && typeof parsed.todayStudyMinutes === 'number'
        ? parsed.todayStudyMinutes
        : parsed.todayDate === today && typeof parsed.minutosEstudados === 'number'
        ? parsed.minutosEstudados
        : 0;

    const todayIds =
      parsed.todayDate === today && Array.isArray(parsed.todayReviewedCardIds)
        ? parsed.todayReviewedCardIds
        : [];

    const monthlyIdsRaw =
      parsed.currentMonthKey === currentMonth && Array.isArray(parsed.monthlyReviewedCardIds)
        ? parsed.monthlyReviewedCardIds
        : [];

    const mergedMonthlyIds = Array.from(new Set([...monthlyIdsRaw, ...todayIds]));

    const base: UserStudyStats = {
      dailyGoal: typeof parsed.dailyGoal === 'number' && parsed.dailyGoal > 0 ? parsed.dailyGoal : 15,
      todayDate: today,
      todayReviewedCardIds: todayIds,
      monthlyReviewedCardIds: mergedMonthlyIds,
      todayStudyMinutes: parsedTodayMinutes,
      minutosEstudados: Math.round(parsedTodayMinutes),
      monthlyActiveDays:
        parsed.currentMonthKey === currentMonth && Array.isArray(parsed.monthlyActiveDays)
          ? parsed.monthlyActiveDays
          : [],
      monthlyStudyMinutes:
        parsed.currentMonthKey === currentMonth && typeof parsed.monthlyStudyMinutes === 'number'
          ? parsed.monthlyStudyMinutes
          : 0,
      currentMonthKey: currentMonth,
      lastActiveTimestamp:
        typeof parsed.lastActiveTimestamp === 'number' ? parsed.lastActiveTimestamp : Date.now(),
      todayDiscoveryDate: today,
      todayDiscoveryKeys:
        parsed.todayDiscoveryDate === today && Array.isArray(parsed.todayDiscoveryKeys)
          ? parsed.todayDiscoveryKeys.slice(0, MAX_DAILY_DISCOVERY_BONUSES)
          : [],
      monthlyDiscoveryBonusXp:
        parsed.currentMonthKey === currentMonth && typeof parsed.monthlyDiscoveryBonusXp === 'number'
          ? Math.max(0, Math.floor(parsed.monthlyDiscoveryBonusXp))
          : 0,
      todaySpeakingDate: today,
      todaySpeakingPhraseRewards:
        parsed.todaySpeakingDate === today &&
        parsed.todaySpeakingPhraseRewards &&
        typeof parsed.todaySpeakingPhraseRewards === 'object'
          ? { ...parsed.todaySpeakingPhraseRewards }
          : {},
      monthlySpeakingXp:
        parsed.currentMonthKey === currentMonth && typeof parsed.monthlySpeakingXp === 'number'
          ? Math.max(0, Math.floor(parsed.monthlySpeakingXp))
          : 0,
    };

    return base;
  } catch {
    return getDefaultStudyStats();
  }
}

export function saveUserStudyStats(stats: UserStudyStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function loadCachedLeaderboardRecords(): CloudLeaderboardRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const currentMonth = getCurrentMonthKey();
    return parsed.filter(
      (item): item is CloudLeaderboardRecord =>
        Boolean(item && typeof item.uid === 'string' && item.monthKey === currentMonth && item.score > 0)
    );
  } catch {
    return [];
  }
}

export function saveCachedLeaderboardRecords(records: CloudLeaderboardRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    const currentMonth = getCurrentMonthKey();
    const filtered = records.filter((r) => r.monthKey === currentMonth && r.score > 0);
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function recordCardReviewInStats(
  cardId: string,
  current: UserStudyStats,
  now = new Date()
): UserStudyStats {
  const today = getTodayDateString(now);
  const currentMonth = getCurrentMonthKey(now);

  const isNewDay = current.todayDate !== today;
  const isNewMonth = current.currentMonthKey !== currentMonth;

  const existingTodayIds = isNewDay ? [] : [...current.todayReviewedCardIds];
  if (cardId && !existingTodayIds.includes(cardId)) {
    existingTodayIds.push(cardId);
  }

  const existingMonthlyIds = isNewMonth ? [] : [...(current.monthlyReviewedCardIds || [])];
  if (cardId && !existingMonthlyIds.includes(cardId)) {
    existingMonthlyIds.push(cardId);
  }

  const existingActiveDays = isNewMonth ? [] : [...current.monthlyActiveDays];
  if (!existingActiveDays.includes(today)) {
    existingActiveDays.push(today);
  }

  const updated: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    todayReviewedCardIds: existingTodayIds,
    monthlyReviewedCardIds: existingMonthlyIds,
    monthlyActiveDays: existingActiveDays,
    monthlyStudyMinutes: isNewMonth ? 0 : current.monthlyStudyMinutes,
    lastActiveTimestamp: now.getTime(),
  };

  saveUserStudyStats(updated);
  return updated;
}

export function recordStudyTimeInStats(
  secondsDelta: number,
  current: UserStudyStats,
  now = new Date()
): UserStudyStats {
  if (secondsDelta <= 0) return current;
  const today = getTodayDateString(now);
  const currentMonth = getCurrentMonthKey(now);
  const isNewDay = current.todayDate !== today;
  const isNewMonth = current.currentMonthKey !== currentMonth;

  const addedMinutes = Math.round((secondsDelta / 60) * 10) / 10;
  const newTodayMinutes = isNewDay
    ? addedMinutes
    : Math.round(((current.todayStudyMinutes || current.minutosEstudados || 0) + addedMinutes) * 10) / 10;
  const newMonthlyMinutes = isNewMonth
    ? addedMinutes
    : Math.round((current.monthlyStudyMinutes + addedMinutes) * 10) / 10;

  const existingActiveDays = isNewMonth ? [] : [...current.monthlyActiveDays];
  if (newTodayMinutes >= 1 && !existingActiveDays.includes(today)) {
    existingActiveDays.push(today);
  }

  const updated: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    todayStudyMinutes: newTodayMinutes,
    minutosEstudados: Math.round(newTodayMinutes),
    monthlyActiveDays: existingActiveDays,
    monthlyStudyMinutes: newMonthlyMinutes,
    lastActiveTimestamp: now.getTime(),
  };

  saveUserStudyStats(updated);
  return updated;
}

export function setDailyGoalInStats(
  newGoal: number,
  current: UserStudyStats
): UserStudyStats {
  const cleanGoal = Math.max(5, Math.min(100, Math.floor(newGoal || 15)));
  const updated: UserStudyStats = {
    ...current,
    dailyGoal: cleanGoal,
  };
  saveUserStudyStats(updated);
  return updated;
}

/**
 * Anti-Farming Symbolic Discovery Bonus (+2 XP, hard cap of 5 bonuses per user per YYYY-MM-DD day).
 * From the 6th discovery onward on the same day, returns `awardedXp: 0` while keeping catalog feeding active.
 */
export function recordGlobalDiscoveryBonusInStats(
  canonicalKey: string,
  current: UserStudyStats,
  now = new Date()
): {
  updatedStats: UserStudyStats;
  awardedXp: number;
  dailyCount: number;
  cappedOut: boolean;
} {
  const cleanKey = String(canonicalKey || '').trim().toLowerCase();
  if (!cleanKey) {
    return { updatedStats: current, awardedXp: 0, dailyCount: 0, cappedOut: false };
  }

  const today = getTodayDateString(now);
  const currentMonth = getCurrentMonthKey(now);
  const isNewMonth = current.currentMonthKey !== currentMonth;
  const isNewDiscoveryDay = current.todayDiscoveryDate !== today;

  const existingTodayKeys = isNewDiscoveryDay
    ? []
    : [...(current.todayDiscoveryKeys || [])];
  const baseMonthlyBonus = isNewMonth
    ? 0
    : Math.max(0, Math.floor(current.monthlyDiscoveryBonusXp || 0));

  if (existingTodayKeys.includes(cleanKey)) {
    return {
      updatedStats: current,
      awardedXp: 0,
      dailyCount: existingTodayKeys.length,
      cappedOut: false,
    };
  }

  if (existingTodayKeys.length >= MAX_DAILY_DISCOVERY_BONUSES) {
    const cappedStats: UserStudyStats = {
      ...current,
      todayDate: today,
      currentMonthKey: currentMonth,
      todayDiscoveryDate: today,
      todayDiscoveryKeys: existingTodayKeys,
      monthlyDiscoveryBonusXp: baseMonthlyBonus,
      lastActiveTimestamp: now.getTime(),
    };
    saveUserStudyStats(cappedStats);
    return {
      updatedStats: cappedStats,
      awardedXp: 0,
      dailyCount: existingTodayKeys.length,
      cappedOut: true,
    };
  }

  const nextTodayKeys = [...existingTodayKeys, cleanKey];
  const nextActiveDays = isNewMonth ? [] : [...current.monthlyActiveDays];
  if (!nextActiveDays.includes(today)) {
    nextActiveDays.push(today);
  }

  const updatedStats: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    monthlyActiveDays: nextActiveDays,
    monthlyStudyMinutes: isNewMonth ? 0 : current.monthlyStudyMinutes,
    todayDiscoveryDate: today,
    todayDiscoveryKeys: nextTodayKeys,
    monthlyDiscoveryBonusXp: baseMonthlyBonus + DISCOVERY_BONUS_XP,
    lastActiveTimestamp: now.getTime(),
  };

  saveUserStudyStats(updatedStats);
  return {
    updatedStats,
    awardedXp: DISCOVERY_BONUS_XP,
    dailyCount: nextTodayKeys.length,
    cappedOut: false,
  };
}

/**
 * Speaking Practice XP with strict per-phrase/day Anti-Farming Lock:
 * - `NATIVE_LIKE` (🟢): up to +5 XP per unique phrase per day
 * - `UNDERSTANDABLE_POLISH` (🟡): up to +3 XP per unique phrase per day (upgrading to NATIVE_LIKE on the same day awards the +2 XP delta)
 * - `NEEDS_PRACTICE` (🔴): 0 XP
 */
export function recordSpeakingPracticeInStats(
  phraseKey: string,
  verdict: 'NATIVE_LIKE' | 'UNDERSTANDABLE_POLISH' | 'NEEDS_PRACTICE',
  current: UserStudyStats,
  now = new Date()
): {
  updatedStats: UserStudyStats;
  awardedXp: number;
  alreadyRewardedToday: boolean;
  dailyCappedOut: boolean;
} {
  const cleanKey = String(phraseKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);

  const targetTierXp =
    verdict === 'NATIVE_LIKE'
      ? SPEAKING_NATIVE_XP
      : verdict === 'UNDERSTANDABLE_POLISH'
      ? SPEAKING_POLISH_XP
      : 0;

  if (!cleanKey || targetTierXp <= 0) {
    return {
      updatedStats: current,
      awardedXp: 0,
      alreadyRewardedToday: false,
      dailyCappedOut: false,
    };
  }

  const today = getTodayDateString(now);
  const currentMonth = getCurrentMonthKey(now);
  const isNewMonth = current.currentMonthKey !== currentMonth;
  const isNewSpeakingDay = current.todaySpeakingDate !== today;

  const existingRewards: Record<string, number> = isNewSpeakingDay
    ? {}
    : { ...(current.todaySpeakingPhraseRewards || {}) };
  const baseMonthlySpeakingXp = isNewMonth
    ? 0
    : Math.max(0, Math.floor(current.monthlySpeakingXp || 0));

  const previousPhraseXp = Math.max(0, Math.floor(existingRewards[cleanKey] || 0));
  if (targetTierXp <= previousPhraseXp) {
    return {
      updatedStats: current,
      awardedXp: 0,
      alreadyRewardedToday: true,
      dailyCappedOut: false,
    };
  }

  const todayAccumulatedSpeakingXp = Object.values(existingRewards).reduce(
    (sum, val) => sum + (typeof val === 'number' && val > 0 ? val : 0),
    0
  );

  const remainingDailyAllowance = Math.max(
    0,
    MAX_DAILY_SPEAKING_XP - todayAccumulatedSpeakingXp
  );
  if (remainingDailyAllowance <= 0) {
    return {
      updatedStats: current,
      awardedXp: 0,
      alreadyRewardedToday: false,
      dailyCappedOut: true,
    };
  }

  const rawDelta = targetTierXp - previousPhraseXp;
  const awardedXp = Math.min(rawDelta, remainingDailyAllowance);

  const nextRewards: Record<string, number> = {
    ...existingRewards,
    [cleanKey]: previousPhraseXp + awardedXp,
  };

  const nextActiveDays = isNewMonth ? [] : [...current.monthlyActiveDays];
  if (!nextActiveDays.includes(today)) {
    nextActiveDays.push(today);
  }

  const updatedStats: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    monthlyActiveDays: nextActiveDays,
    monthlyStudyMinutes: isNewMonth ? 0 : current.monthlyStudyMinutes,
    todaySpeakingDate: today,
    todaySpeakingPhraseRewards: nextRewards,
    monthlySpeakingXp: baseMonthlySpeakingXp + awardedXp,
    lastActiveTimestamp: now.getTime(),
  };

  saveUserStudyStats(updatedStats);
  return {
    updatedStats,
    awardedXp,
    alreadyRewardedToday: false,
    dailyCappedOut: false,
  };
}

export function formatStudyHoursMinutes(minutes: number): string {
  const totalMin = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function getMonthNamePt(date = new Date()): string {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return months[date.getMonth()] || 'Mês Atual';
}

export function formatLeaderboardIdentity(
  displayName?: string | null,
  email?: string | null
): { name: string; shortName: string; initials: string } {
  const trimmed = (displayName || '').trim();
  let resolved = trimmed;
  if (!resolved && email && email.includes('@')) {
    const localPart = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    if (localPart) {
      resolved = localPart
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  if (!resolved) {
    resolved = 'Você (Aluno EWM)';
  }

  const parts = resolved.split(/\s+/).filter(Boolean);
  const shortName =
    parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : parts[0];
  const initials =
    parts.length > 1
      ? `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
      : resolved.slice(0, 2).toUpperCase();

  return {
    name: resolved.slice(0, 80),
    shortName: shortName.slice(0, 40),
    initials: initials.slice(0, 4) || 'EW',
  };
}

export interface RealScoreInputs {
  stats: UserStudyStats;
  masteredCount?: number;
  reviewCount?: number;
  quizScore?: number;
}

/**
 * 100% Real, Legitimate Student Score Calculation (Zero Fictional Baselines or Multipliers):
 * - Dominated Card: +20 pts
 * - Card Marked for Review: +8 pts
 * - Unique Card Practiced in Month: +10 pts
 * - Correct Quiz Answer: +15 pts
 * - Active Day in Month: +50 pts
 * - Full Study Minute: +2 pts
 */
export function computeRealStudentMetrics(inputs: RealScoreInputs): {
  cardsReviewed: number;
  masteredCount: number;
  reviewCount: number;
  quizScore: number;
  activeDays: number;
  studyTimeMinutes: number;
  minutosEstudados: number;
  score: number;
  statusText: string;
} {
  const mastered = Math.max(0, Math.floor(inputs.masteredCount || 0));
  const review = Math.max(0, Math.floor(inputs.reviewCount || 0));
  const quiz = Math.max(0, Math.floor(inputs.quizScore || 0));

  const monthlyUniqueCards = Array.from(
    new Set([
      ...(inputs.stats.monthlyReviewedCardIds || []),
      ...(inputs.stats.todayReviewedCardIds || []),
    ])
  ).length;

  // Total real cards interacted with (at least mastered + review if progressed earlier)
  const cardsReviewed = Math.max(monthlyUniqueCards, mastered + review);
  const discoveryBonusXp = Math.max(0, Math.floor(inputs.stats.monthlyDiscoveryBonusXp || 0));
  const speakingXp = Math.max(0, Math.floor(inputs.stats.monthlySpeakingXp || 0));
  const activeDays = Math.max(
    inputs.stats.monthlyActiveDays.length,
    cardsReviewed > 0 || quiz > 0 || discoveryBonusXp > 0 || speakingXp > 0 ? 1 : 0
  );
  const studyTimeMinutes = Math.max(0, Math.floor(inputs.stats.monthlyStudyMinutes || 0));
  const minutosEstudados = Math.max(
    0,
    Math.round(inputs.stats.todayStudyMinutes || inputs.stats.minutosEstudados || 0)
  );

  const score =
    mastered * 20 +
    review * 8 +
    cardsReviewed * 10 +
    quiz * 15 +
    (cardsReviewed > 0 || quiz > 0 || studyTimeMinutes > 0 || speakingXp > 0
      ? activeDays * 50
      : 0) +
    studyTimeMinutes * 2 +
    discoveryBonusXp +
    speakingXp;

  let statusText = 'Pronto para iniciar';
  if (mastered >= 20) statusText = `${mastered} expressões dominadas`;
  else if (quiz >= 5) statusText = `${quiz} acertos no Modo Quiz`;
  else if (speakingXp >= 15) statusText = 'Treinando pronúncia no Speaking Lab';
  else if (cardsReviewed > 0) statusText = `${cardsReviewed} cards praticados`;
  else if (speakingXp > 0) statusText = 'Praticando pronúncia US & UK';
  else if (discoveryBonusXp > 0) statusText = 'Expandindo o Acervo EWM';
  else if (studyTimeMinutes > 0) statusText = 'Praticando pronúncia US & UK';

  return {
    cardsReviewed,
    masteredCount: mastered,
    reviewCount: review,
    quizScore: quiz,
    activeDays: score > 0 ? activeDays : 0,
    studyTimeMinutes,
    minutosEstudados,
    score,
    statusText,
  };
}

export interface ComputeLeaderboardOptions {
  currentUid?: string | null;
  currentUserEmail?: string | null;
  masteredCount?: number;
  reviewCount?: number;
  quizScore?: number;
  cloudEntries?: CloudLeaderboardRecord[];
}

/**
 * Computes the 100% Real Community Leaderboard.
 * - Zero fictional/mock students.
 * - Deduplicates strictly by `uid` so the current student never appears twice.
 * - Returns empty `allRanked` and `topStudent = null` when no real student has scored > 0 points yet.
 */
export function computeLeaderboard(
  currentUserName: string | null | undefined,
  userStats: UserStudyStats,
  options: ComputeLeaderboardOptions = {}
): {
  topThree: StudentLeaderboardEntry[];
  allRanked: StudentLeaderboardEntry[];
  currentUserEntry: StudentLeaderboardEntry;
  topStudent: StudentLeaderboardEntry | null;
} {
  const currentMonth = getCurrentMonthKey();
  const identity = formatLeaderboardIdentity(currentUserName, options.currentUserEmail);
  const localMetrics = computeRealStudentMetrics({
    stats: userStats,
    masteredCount: options.masteredCount,
    reviewCount: options.reviewCount,
    quizScore: options.quizScore,
  });

  const resolvedUserId = options.currentUid || 'local_current_user';
  const cloudSource =
    options.cloudEntries && options.cloudEntries.length > 0
      ? options.cloudEntries
      : loadCachedLeaderboardRecords();

  const mergedByUid = new Map<
    string,
    Omit<StudentLeaderboardEntry, 'rank' | 'badgeEmoji'>
  >();

  // 1. Add real cloud community students for the current month (strictly score > 0)
  for (const rec of cloudSource) {
    if (!rec || !rec.uid || rec.monthKey !== currentMonth || rec.score <= 0) continue;
    const isSelf = Boolean(options.currentUid && rec.uid === options.currentUid);
    const isRecentlyActive = Date.now() - (rec.updatedAtMs || 0) < 10 * 60 * 1000;

    mergedByUid.set(rec.uid, {
      id: rec.uid,
      name: rec.name,
      shortName: rec.shortName,
      initials: rec.initials,
      avatarUrl: rec.avatarUrl,
      isCurrentUser: isSelf,
      cardsReviewed: rec.cardsReviewed,
      masteredCount: rec.masteredCount,
      reviewCount: rec.reviewCount,
      quizScore: rec.quizScore,
      activeDays: rec.activeDays,
      studyTimeMinutes: rec.studyTimeMinutes,
      minutosEstudados: rec.minutosEstudados,
      score: rec.score,
      statusText: rec.statusText || 'Estudando no EWM',
      isOnline: isSelf || isRecentlyActive,
    });
  }

  // 2. Merge current student's live local progress without duplicating their cloud record
  const existingSelfCloud = options.currentUid
    ? mergedByUid.get(options.currentUid)
    : undefined;

  const mergedSelfScore = Math.max(localMetrics.score, existingSelfCloud?.score || 0);
  const mergedSelfCards = Math.max(
    localMetrics.cardsReviewed,
    existingSelfCloud?.cardsReviewed || 0
  );
  const mergedSelfMastered = Math.max(
    localMetrics.masteredCount,
    existingSelfCloud?.masteredCount || 0
  );
  const mergedSelfReview = Math.max(
    localMetrics.reviewCount,
    existingSelfCloud?.reviewCount || 0
  );
  const mergedSelfQuiz = Math.max(
    localMetrics.quizScore,
    existingSelfCloud?.quizScore || 0
  );
  const mergedSelfDays = Math.max(
    localMetrics.activeDays,
    existingSelfCloud?.activeDays || 0
  );
  const mergedSelfMinutes = Math.max(
    localMetrics.studyTimeMinutes,
    existingSelfCloud?.studyTimeMinutes || 0
  );
  const mergedSelfTodayMinutes = Math.max(
    localMetrics.minutosEstudados,
    existingSelfCloud?.minutosEstudados || 0
  );

  const selfBase: Omit<StudentLeaderboardEntry, 'rank' | 'badgeEmoji'> = {
    id: resolvedUserId,
    name: identity.name,
    shortName: identity.shortName,
    initials: identity.initials,
    isCurrentUser: true,
    cardsReviewed: mergedSelfCards,
    masteredCount: mergedSelfMastered,
    reviewCount: mergedSelfReview,
    quizScore: mergedSelfQuiz,
    activeDays: mergedSelfDays,
    studyTimeMinutes: mergedSelfMinutes,
    minutosEstudados: mergedSelfTodayMinutes,
    score: mergedSelfScore,
    statusText:
      mergedSelfScore > 0 ? localMetrics.statusText : 'Pratique 1 card para estrear no Ranking',
    isOnline: true,
  };

  if (mergedSelfScore > 0) {
    mergedByUid.set(resolvedUserId, selfBase);
  } else if (options.currentUid) {
    mergedByUid.delete(options.currentUid);
  }

  // 3. Sort real participants by score (desc), then cardsReviewed (desc), then studyTimeMinutes (desc)
  const sortedPool = Array.from(mergedByUid.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.cardsReviewed !== a.cardsReviewed) return b.cardsReviewed - a.cardsReviewed;
    return b.studyTimeMinutes - a.studyTimeMinutes;
  });

  const allRanked: StudentLeaderboardEntry[] = sortedPool.map((entry, index) => {
    const rank = index + 1;
    let badgeEmoji = `#${rank}`;
    if (rank === 1) badgeEmoji = '🥇';
    else if (rank === 2) badgeEmoji = '🥈';
    else if (rank === 3) badgeEmoji = '🥉';

    return {
      ...entry,
      rank,
      badgeEmoji,
    };
  });

  const topThree = allRanked.slice(0, 3);
  const topStudent = allRanked[0] ?? null;

  const rankedSelf = allRanked.find((e) => e.isCurrentUser);
  const currentUserEntry: StudentLeaderboardEntry = rankedSelf ?? {
    ...selfBase,
    rank: 0,
    badgeEmoji: '🎯',
  };

  return { topThree, allRanked, currentUserEntry, topStudent };
}
