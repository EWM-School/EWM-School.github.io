import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeLeaderboard,
  formatStudyHoursMinutes,
  getCurrentMonthKey,
  getDefaultStudyStats,
  getTodayDateString,
  recordCardReviewInStats,
  recordStudyTimeInStats,
  setDailyGoalInStats,
} from './studyMetrics';

test('studyMetrics: handles default values and date formatting cleanly', () => {
  const now = new Date(2026, 10, 11); // Nov 11, 2026
  assert.equal(getTodayDateString(now), '2026-11-11');
  assert.equal(getCurrentMonthKey(now), '2026-11');

  const def = getDefaultStudyStats(now);
  assert.equal(def.dailyGoal, 15);
  assert.equal(def.todayDate, '2026-11-11');
  assert.equal(def.todayReviewedCardIds.length, 0);
  assert.equal(def.monthlyActiveDays.length, 0);
  assert.equal(def.monthlyStudyMinutes, 0);
});

test('studyMetrics: recordCardReviewInStats tracks unique cards reviewed today and active days', () => {
  const day1 = new Date(2026, 10, 11);
  let stats = getDefaultStudyStats(day1);

  // Review card 1
  stats = recordCardReviewInStats('c1', stats, day1);
  assert.equal(stats.todayReviewedCardIds.length, 1);
  assert.equal(stats.monthlyActiveDays.length, 1);
  assert.equal(stats.monthlyActiveDays[0], '2026-11-11');

  // Review same card again (should not duplicate)
  stats = recordCardReviewInStats('c1', stats, day1);
  assert.equal(stats.todayReviewedCardIds.length, 1);

  // Review second card
  stats = recordCardReviewInStats('c2', stats, day1);
  assert.equal(stats.todayReviewedCardIds.length, 2);
  assert.equal(stats.monthlyActiveDays.length, 1);

  // Next day: today's reviewed list resets, but monthly active days increases
  const day2 = new Date(2026, 10, 12);
  stats = recordCardReviewInStats('c3', stats, day2);
  assert.equal(stats.todayReviewedCardIds.length, 1);
  assert.equal(stats.todayReviewedCardIds[0], 'c3');
  assert.equal(stats.monthlyActiveDays.length, 2);
  assert.ok(stats.monthlyActiveDays.includes('2026-11-11'));
  assert.ok(stats.monthlyActiveDays.includes('2026-11-12'));
});

test('studyMetrics: recordStudyTimeInStats accumulates minutes correctly', () => {
  const now = new Date(2026, 10, 11);
  let stats = getDefaultStudyStats(now);

  stats = recordStudyTimeInStats(60, stats, now); // +1 min
  assert.equal(stats.monthlyStudyMinutes, 1);

  stats = recordStudyTimeInStats(120, stats, now); // +2 min
  assert.equal(stats.monthlyStudyMinutes, 3);
});

test('studyMetrics: setDailyGoalInStats clamps goal within safe bounds', () => {
  const stats = getDefaultStudyStats();
  assert.equal(setDailyGoalInStats(20, stats).dailyGoal, 20);
  assert.equal(setDailyGoalInStats(2, stats).dailyGoal, 5); // min 5
  assert.equal(setDailyGoalInStats(150, stats).dailyGoal, 100); // max 100
});

test('studyMetrics: formatStudyHoursMinutes formats hours and minutes properly', () => {
  assert.equal(formatStudyHoursMinutes(0), '0m');
  assert.equal(formatStudyHoursMinutes(45), '45m');
  assert.equal(formatStudyHoursMinutes(60), '1h');
  assert.equal(formatStudyHoursMinutes(90), '1h 30m');
  assert.equal(formatStudyHoursMinutes(620), '10h 20m');
});

test('studyMetrics: computeLeaderboard enforces Zero-Mocks solo state and ranks real Top 3 students', () => {
  const stats = getDefaultStudyStats();
  stats.todayReviewedCardIds = ['c1', 'c2', 'c3', 'c4', 'c5'];
  stats.monthlyActiveDays = ['2026-11-01', '2026-11-02', '2026-11-11'];
  stats.monthlyStudyMinutes = 120;

  // 1. Solo state (Zero Mocks): only the real student appears, zero fake bots
  const soloResult = computeLeaderboard('Igor Souza', stats);
  assert.equal(soloResult.topThree.length, 1);
  assert.equal(soloResult.topThree[0].name, 'Igor Souza');
  assert.equal(soloResult.topThree[0].rank, 1);
  assert.equal(soloResult.topThree[0].badgeEmoji, '🥇');

  // 2. Real multi-student monthly ranking with real cloud peers
  const monthKey = stats.currentMonthKey;
  const result = computeLeaderboard('Igor Souza', stats, {
    currentUid: 'uid-igor',
    cloudEntries: [
      {
        uid: 'uid-ana',
        name: 'Ana Clara',
        shortName: 'Ana C.',
        initials: 'AC',
        monthKey,
        cardsReviewed: 40,
        masteredCount: 25,
        reviewCount: 10,
        quizScore: 15,
        activeDays: 10,
        studyTimeMinutes: 300,
        minutosEstudados: 45,
        score: 2400,
        statusText: 'Dominando Phrasal Verbs',
        updatedAtMs: Date.now(),
      },
      {
        uid: 'uid-lucas',
        name: 'Lucas Mendes',
        shortName: 'Lucas M.',
        initials: 'LM',
        monthKey,
        cardsReviewed: 20,
        masteredCount: 12,
        reviewCount: 5,
        quizScore: 8,
        activeDays: 5,
        studyTimeMinutes: 150,
        minutosEstudados: 20,
        score: 1250,
        statusText: 'Treinando Speaking Lab',
        updatedAtMs: Date.now(),
      },
    ],
  });

  assert.equal(result.topThree.length, 3);
  assert.equal(result.topThree[0].rank, 1);
  assert.equal(result.topThree[0].badgeEmoji, '🥇');
  assert.equal(result.topThree[1].rank, 2);
  assert.equal(result.topThree[1].badgeEmoji, '🥈');
  assert.equal(result.topThree[2].rank, 3);
  assert.equal(result.topThree[2].badgeEmoji, '🥉');

  assert.ok(result.currentUserEntry);
  assert.equal(result.currentUserEntry.name, 'Igor Souza');
  assert.equal(result.currentUserEntry.isCurrentUser, true);
  assert.ok(typeof result.currentUserEntry.minutosEstudados === 'number');
  assert.ok(typeof result.currentUserEntry.score === 'number');
  assert.ok(result.topStudent);
  assert.equal(result.topStudent.rank, 1);
  assert.ok(result.topStudent.score > 0);
  assert.ok(typeof result.topStudent.minutosEstudados === 'number');
});
