export interface StudentLeaderboardEntry {
  id: string;
  name: string;
  shortName: string;
  avatarUrl?: string;
  initials: string;
  isCurrentUser?: boolean;
  cardsReviewed: number;
  activeDays: number;
  studyTimeMinutes: number; // total monthly study minutes
  minutosEstudados: number; // daily study minutes (metadados do ranking)
  score: number; // total points in ranking
  rank: number;
  badgeEmoji: string;
  statusText: string;
  isOnline: boolean;
}

export interface UserStudyStats {
  dailyGoal: number;
  todayDate: string; // YYYY-MM-DD
  todayReviewedCardIds: string[];
  todayStudyMinutes: number; // daily study minutes
  minutosEstudados?: number; // alias for daily study minutes
  monthlyActiveDays: string[]; // YYYY-MM-DD
  monthlyStudyMinutes: number;
  currentMonthKey: string; // YYYY-MM
  lastActiveTimestamp: number;
}

const STORAGE_KEY = 'ewm_v5_study_metrics';

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
    todayStudyMinutes: 0,
    minutosEstudados: 0,
    monthlyActiveDays: [],
    monthlyStudyMinutes: 0,
    currentMonthKey: getCurrentMonthKey(d),
    lastActiveTimestamp: d.getTime(),
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

    const base: UserStudyStats = {
      dailyGoal: typeof parsed.dailyGoal === 'number' && parsed.dailyGoal > 0 ? parsed.dailyGoal : 15,
      todayDate: today,
      todayReviewedCardIds: parsed.todayDate === today && Array.isArray(parsed.todayReviewedCardIds)
        ? parsed.todayReviewedCardIds
        : [],
      todayStudyMinutes: parsedTodayMinutes,
      minutosEstudados: Math.round(parsedTodayMinutes),
      monthlyActiveDays: parsed.currentMonthKey === currentMonth && Array.isArray(parsed.monthlyActiveDays)
        ? parsed.monthlyActiveDays
        : [],
      monthlyStudyMinutes: parsed.currentMonthKey === currentMonth && typeof parsed.monthlyStudyMinutes === 'number'
        ? parsed.monthlyStudyMinutes
        : 0,
      currentMonthKey: currentMonth,
      lastActiveTimestamp: typeof parsed.lastActiveTimestamp === 'number' ? parsed.lastActiveTimestamp : Date.now(),
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

  const existingActiveDays = isNewMonth ? [] : [...current.monthlyActiveDays];
  if (!existingActiveDays.includes(today)) {
    existingActiveDays.push(today);
  }

  const updated: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    todayReviewedCardIds: existingTodayIds,
    monthlyActiveDays: existingActiveDays,
    monthlyStudyMinutes: isNewMonth ? 1 : current.monthlyStudyMinutes,
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

  const updated: UserStudyStats = {
    ...current,
    todayDate: today,
    currentMonthKey: currentMonth,
    todayStudyMinutes: newTodayMinutes,
    minutosEstudados: Math.round(newTodayMinutes),
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

/**
 * Community benchmark students for EWM Keep practicing leaderboard.
 * Combined dynamically with current student's real live activity.
 */
const BENCHMARK_STUDENTS: Omit<StudentLeaderboardEntry, 'rank' | 'badgeEmoji' | 'score'>[] = [
  {
    id: 'student_sofia',
    name: 'Sofia Ribeiro',
    shortName: 'Sofia R.',
    initials: 'SR',
    cardsReviewed: 485,
    activeDays: 24,
    studyTimeMinutes: 1140, // 19h
    minutosEstudados: 48, // minutos estudados hoje
    statusText: 'Revisando Phrasal Verbs',
    isOnline: true,
  },
  {
    id: 'student_lucas',
    name: 'Lucas Ferreira',
    shortName: 'Lucas F.',
    initials: 'LF',
    cardsReviewed: 412,
    activeDays: 22,
    studyTimeMinutes: 930, // 15h 30m
    minutosEstudados: 42,
    statusText: 'Focado em Expressões de Viagem',
    isOnline: true,
  },
  {
    id: 'student_beatriz',
    name: 'Beatriz Mendes',
    shortName: 'Beatriz M.',
    initials: 'BM',
    cardsReviewed: 350,
    activeDays: 19,
    studyTimeMinutes: 790, // 13h 10m
    minutosEstudados: 35,
    statusText: 'Dominando gírias de trabalho',
    isOnline: false,
  },
  {
    id: 'student_thiago',
    name: 'Thiago Oliveira',
    shortName: 'Thiago O.',
    initials: 'TO',
    cardsReviewed: 290,
    activeDays: 16,
    studyTimeMinutes: 620, // 10h 20m
    minutosEstudados: 25,
    statusText: 'Praticando sotaque britânico',
    isOnline: false,
  },
];

export function computeLeaderboard(
  currentUserName: string | null | undefined,
  userStats: UserStudyStats
): {
  topThree: StudentLeaderboardEntry[];
  allRanked: StudentLeaderboardEntry[];
  currentUserEntry: StudentLeaderboardEntry;
  topStudent: StudentLeaderboardEntry;
} {
  const displayName = (currentUserName || 'Você (Aluno)').trim();
  const nameParts = displayName.split(' ');
  const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1].charAt(0)}.` : nameParts[0];
  const initials = nameParts.length > 1
    ? `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  // User monthly score = (cards * 10) + (days * 60) + (hours * 25)
  // Base starting baseline for student so they can climb the rankings
  const userCards = Math.max(userStats.todayReviewedCardIds.length * 3, userStats.todayReviewedCardIds.length);
  const userDays = Math.max(userStats.monthlyActiveDays.length, userStats.todayReviewedCardIds.length > 0 ? 1 : 0);
  const userMinutes = Math.max(Math.round(userStats.monthlyStudyMinutes), userDays * 12);
  const userDailyMinutes = Math.max(
    Math.round(userStats.todayStudyMinutes || userStats.minutosEstudados || 0),
    userStats.todayReviewedCardIds.length > 0 ? Math.round(userStats.todayReviewedCardIds.length * 1.5) : 0
  );

  const userEntry: Omit<StudentLeaderboardEntry, 'rank' | 'badgeEmoji' | 'score'> = {
    id: 'current_user',
    name: displayName,
    shortName,
    initials,
    isCurrentUser: true,
    cardsReviewed: userCards,
    activeDays: userDays,
    studyTimeMinutes: userMinutes,
    minutosEstudados: userDailyMinutes,
    statusText: 'Estudando agora',
    isOnline: true,
  };

  const poolWithScore = [...BENCHMARK_STUDENTS, userEntry].map((entry) => {
    const score = Math.round(
      entry.cardsReviewed * 10 + entry.activeDays * 60 + (entry.studyTimeMinutes / 60) * 25
    );
    return {
      ...entry,
      score,
    };
  });

  // Rank formula prioritizes calculated total score
  poolWithScore.sort((a, b) => b.score - a.score);

  const allRanked: StudentLeaderboardEntry[] = poolWithScore.map((entry, index) => {
    const rank = index + 1;
    let badgeEmoji = '⭐';
    if (rank === 1) badgeEmoji = '🥇';
    else if (rank === 2) badgeEmoji = '🥈';
    else if (rank === 3) badgeEmoji = '🥉';
    else badgeEmoji = `#${rank}`;

    return {
      ...entry,
      rank,
      badgeEmoji,
    };
  });

  const topThree = allRanked.slice(0, 3);
  const currentUserEntry = allRanked.find((e) => e.isCurrentUser) || allRanked[allRanked.length - 1];
  const topStudent = allRanked[0];

  return { topThree, allRanked, currentUserEntry, topStudent };
}
