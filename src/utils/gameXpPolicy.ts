import {
  getCurrentMonthKey,
  getTodayDateString,
  saveUserStudyStats,
  type UserStudyStats,
} from './studyMetrics';

export type MiniGameId =
  | 'expression-builder'
  | 'native-ear'
  | 'lightning-match'
  | 'survival';

export const MIN_MATCH_BASE_XP = 8;
export const MAX_MATCH_BASE_XP = 15;
export const PERFECT_MATCH_BONUS_XP = 3;
export const MAX_DAILY_GAMES_ARENA_XP = 120;

export const ARENA_FREE_TRAINING_BADGE_PT =
  'Meta diária de XP da Arena concluída — modo treino livre ativo';

export interface MiniGameSessionMetrics {
  gameId: MiniGameId;
  correctCount: number;
  totalItems: number;
  mistakesCount: number;
  bestStreakInRun?: number;
}

export interface ComputedMatchXpBreakdown {
  baseXp: number;
  perfectBonusXp: number;
  rawTotalXp: number;
  accuracyRatio: number;
  isPerfect: boolean;
}

export interface MiniGameXpAwardOutcome {
  updatedStats: UserStudyStats;
  breakdown: ComputedMatchXpBreakdown;
  awardedXp: number;
  todayTotalGamesXp: number;
  dailyAllowanceRemaining: number;
  dailyCapReached: boolean;
  newSurvivalBestStreak: number;
  beatPreviousRecord: boolean;
}

/**
 * Balanced Pedagogical XP Formula:
 * - Standard completed matches (`expression-builder`, `native-ear`, `lightning-match`):
 *   - Requires meaningful accuracy (`>= 40%` and `correctCount >= 2`) to earn XP;
 *   - Scales proportionally from `+8 XP` (`40%` accuracy) to `+15 XP` (`100%` accuracy);
 *   - Awards `+3 XP` flawless bonus when `mistakesCount === 0` and `100%` accuracy.
 * - Endless `survival` mode:
 *   - Scales from `+8 XP` (at `>= 3` correct challenges) up to `+15 XP` (at `>= 12` correct challenges);
 *   - Awards `+3 XP` bonus when achieving a streak `>= 10` in the run.
 */
export function computeMiniGameMatchXp(
  metrics: MiniGameSessionMetrics
): ComputedMatchXpBreakdown {
  const correct = Math.max(0, Math.floor(metrics.correctCount || 0));
  const total = Math.max(0, Math.floor(metrics.totalItems || 0));
  const mistakes = Math.max(0, Math.floor(metrics.mistakesCount || 0));
  const bestStreak = Math.max(0, Math.floor(metrics.bestStreakInRun || 0));

  if (metrics.gameId === 'survival') {
    if (correct < 3) {
      return {
        baseXp: 0,
        perfectBonusXp: 0,
        rawTotalXp: 0,
        accuracyRatio: total > 0 ? correct / total : 0,
        isPerfect: false,
      };
    }

    const progressRatio = Math.min(1, (correct - 3) / 9);
    const baseXp = Math.round(
      MIN_MATCH_BASE_XP + progressRatio * (MAX_MATCH_BASE_XP - MIN_MATCH_BASE_XP)
    );
    const isEliteStreak = bestStreak >= 10 || (mistakes === 0 && correct >= 8);
    const perfectBonusXp = isEliteStreak ? PERFECT_MATCH_BONUS_XP : 0;

    return {
      baseXp,
      perfectBonusXp,
      rawTotalXp: baseXp + perfectBonusXp,
      accuracyRatio: total > 0 ? Math.min(1, correct / total) : 1,
      isPerfect: isEliteStreak,
    };
  }

  if (total <= 0 || correct < 2) {
    return {
      baseXp: 0,
      perfectBonusXp: 0,
      rawTotalXp: 0,
      accuracyRatio: 0,
      isPerfect: false,
    };
  }

  const accuracyRatio = Math.max(0, Math.min(1, correct / total));
  if (accuracyRatio < 0.4) {
    return {
      baseXp: 0,
      perfectBonusXp: 0,
      rawTotalXp: 0,
      accuracyRatio,
      isPerfect: false,
    };
  }

  const normalizedScale = (accuracyRatio - 0.4) / 0.6;
  const baseXp = Math.round(
    MIN_MATCH_BASE_XP + normalizedScale * (MAX_MATCH_BASE_XP - MIN_MATCH_BASE_XP)
  );
  const isPerfect = correct === total && mistakes === 0;
  const perfectBonusXp = isPerfect ? PERFECT_MATCH_BONUS_XP : 0;

  return {
    baseXp,
    perfectBonusXp,
    rawTotalXp: baseXp + perfectBonusXp,
    accuracyRatio,
    isPerfect,
  };
}

export function getDailyGamesXpSnapshot(
  stats: UserStudyStats,
  now = new Date()
): {
  todayEarnedXp: number;
  remainingXp: number;
  capReached: boolean;
  capLimit: number;
} {
  const today = getTodayDateString(now);
  const todayEarnedXp =
    stats.todayGamesDate === today
      ? Math.max(0, Math.min(MAX_DAILY_GAMES_ARENA_XP, Math.floor(stats.todayGamesEarnedXp || 0)))
      : 0;
  const remainingXp = Math.max(0, MAX_DAILY_GAMES_ARENA_XP - todayEarnedXp);
  return {
    todayEarnedXp,
    remainingXp,
    capReached: todayEarnedXp >= MAX_DAILY_GAMES_ARENA_XP,
    capLimit: MAX_DAILY_GAMES_ARENA_XP,
  };
}

/**
 * Records a completed Mini-Game match in `UserStudyStats`, strictly enforcing
 * the `120 XP/day` (`YYYY-MM-DD`) Anti-Farming Cap while always updating `survivalBestStreak`.
 */
export function recordMiniGameSessionInStats(
  metrics: MiniGameSessionMetrics,
  current: UserStudyStats,
  now = new Date()
): MiniGameXpAwardOutcome {
  const today = getTodayDateString(now);
  const currentMonth = getCurrentMonthKey(now);
  const isNewMonth = current.currentMonthKey !== currentMonth;
  const isNewGamesDay = current.todayGamesDate !== today;

  const breakdown = computeMiniGameMatchXp(metrics);

  const prevTodayGamesXp = isNewGamesDay
    ? 0
    : Math.max(0, Math.floor(current.todayGamesEarnedXp || 0));
  const prevMonthlyGamesXp = isNewMonth
    ? 0
    : Math.max(0, Math.floor(current.monthlyGamesXp || 0));

  const prevBestStreak = Math.max(0, Math.floor(current.survivalBestStreak || 0));
  const candidateStreak =
    metrics.gameId === 'survival'
      ? Math.max(0, Math.floor(metrics.bestStreakInRun || 0))
      : 0;
  const newSurvivalBestStreak = Math.max(prevBestStreak, candidateStreak);
  const beatPreviousRecord = candidateStreak > prevBestStreak && candidateStreak > 0;

  const remainingBefore = Math.max(0, MAX_DAILY_GAMES_ARENA_XP - prevTodayGamesXp);
  const awardedXp = Math.min(breakdown.rawTotalXp, remainingBefore);
  const nextTodayGamesXp = prevTodayGamesXp + awardedXp;
  const dailyAllowanceRemaining = Math.max(0, MAX_DAILY_GAMES_ARENA_XP - nextTodayGamesXp);
  const dailyCapReached =
    nextTodayGamesXp >= MAX_DAILY_GAMES_ARENA_XP ||
    (breakdown.rawTotalXp > 0 && remainingBefore === 0);

  const nextActiveDays = isNewMonth ? [] : [...current.monthlyActiveDays];
  if ((awardedXp > 0 || beatPreviousRecord) && !nextActiveDays.includes(today)) {
    nextActiveDays.push(today);
  }

  const updatedStats: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    monthlyActiveDays: nextActiveDays,
    monthlyStudyMinutes: isNewMonth ? 0 : current.monthlyStudyMinutes,
    todayGamesDate: today,
    todayGamesEarnedXp: nextTodayGamesXp,
    monthlyGamesXp: prevMonthlyGamesXp + awardedXp,
    survivalBestStreak: newSurvivalBestStreak,
    lastActiveTimestamp: now.getTime(),
  };

  saveUserStudyStats(updatedStats);

  return {
    updatedStats,
    breakdown,
    awardedXp,
    todayTotalGamesXp: nextTodayGamesXp,
    dailyAllowanceRemaining,
    dailyCapReached,
    newSurvivalBestStreak,
    beatPreviousRecord,
  };
}
