import { describe, expect, it } from 'vitest';
import { trailingDailyTotals, trailingSleepScores, greetingForHour, formatHeroDistanceKm } from '../../../js/features/hub/hub-stats.js';

function sleepLog(date, durationMinutes = 480, quality = 4) {
  return { date, bedTime: null, wakeTime: null, durationMinutes, quality, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('trailingDailyTotals', () => {
  it('fills every day in the window, even ones with no entries — a real, honest 0, not a gap', () => {
    const totals = trailingDailyTotals([], { days: 3, endDate: '2026-03-15' });
    expect(totals).toEqual([
      { date: '2026-03-13', value: 0 },
      { date: '2026-03-14', value: 0 },
      { date: '2026-03-15', value: 0 },
    ]);
  });

  it('sums same-day entries and leaves other days at their real value', () => {
    const totals = trailingDailyTotals(
      [
        { date: '2026-03-14', value: 3000 },
        { date: '2026-03-15', value: 1200 },
        { date: '2026-03-15', value: 800 },
      ],
      { days: 3, endDate: '2026-03-15' }
    );
    expect(totals).toEqual([
      { date: '2026-03-13', value: 0 },
      { date: '2026-03-14', value: 3000 },
      { date: '2026-03-15', value: 2000 },
    ]);
  });

  it('ignores entries outside the trailing window', () => {
    const totals = trailingDailyTotals([{ date: '2026-03-01', value: 9999 }], { days: 3, endDate: '2026-03-15' });
    expect(totals.every((t) => t.value === 0)).toBe(true);
  });

  it('is oldest-first, ending exactly at endDate', () => {
    const totals = trailingDailyTotals([], { days: 7, endDate: '2026-03-15' });
    expect(totals[0].date).toBe('2026-03-09');
    expect(totals[6].date).toBe('2026-03-15');
  });

  it('handles a trailing window that crosses a month boundary', () => {
    const totals = trailingDailyTotals([], { days: 3, endDate: '2026-03-01' });
    expect(totals.map((t) => t.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('trailingSleepScores', () => {
  it('returns nothing for an empty history — never a fabricated zero night', () => {
    expect(trailingSleepScores([], { days: 7, endDate: '2026-03-15', age: null })).toEqual([]);
  });

  it('skips nights nobody logged, unlike trailingDailyTotals — no zero-fill', () => {
    const logs = [sleepLog('2026-03-13'), sleepLog('2026-03-15')];
    const week = trailingSleepScores(logs, { days: 3, endDate: '2026-03-15', age: null });
    expect(week.map((p) => p.date)).toEqual(['2026-03-13', '2026-03-15']);
  });

  it('is oldest-first', () => {
    const logs = [sleepLog('2026-03-15'), sleepLog('2026-03-13'), sleepLog('2026-03-14')];
    const week = trailingSleepScores(logs, { days: 3, endDate: '2026-03-15', age: null });
    expect(week.map((p) => p.date)).toEqual(['2026-03-13', '2026-03-14', '2026-03-15']);
  });

  it('ignores logs outside the trailing window', () => {
    const logs = [sleepLog('2026-02-01'), sleepLog('2026-03-15')];
    const week = trailingSleepScores(logs, { days: 3, endDate: '2026-03-15', age: null });
    expect(week.map((p) => p.date)).toEqual(['2026-03-15']);
  });

  it('every real point carries a 0-100 score and a real category', () => {
    const logs = [sleepLog('2026-03-14', 480, 5), sleepLog('2026-03-15', 240, 1)];
    const week = trailingSleepScores(logs, { days: 2, endDate: '2026-03-15', age: null });
    for (const point of week) {
      expect(point.score).toBeGreaterThanOrEqual(0);
      expect(point.score).toBeLessThanOrEqual(100);
      expect(['poor', 'fair', 'good', 'great']).toContain(point.category);
    }
  });

  it('never uses a later night\'s data to score an earlier one', () => {
    // A poor, erratic night logged after 2026-03-13 must not affect
    // 2026-03-13's own score — only on-or-before context counts.
    const logsWithoutFuture = [sleepLog('2026-03-13', 480, 5)];
    const logsWithFuture = [sleepLog('2026-03-13', 480, 5), sleepLog('2026-03-20', 120, 1)];
    const scoreWithout = trailingSleepScores(logsWithoutFuture, { days: 1, endDate: '2026-03-13', age: null })[0].score;
    const scoreWith = trailingSleepScores(logsWithFuture, { days: 1, endDate: '2026-03-13', age: null })[0].score;
    expect(scoreWith).toBe(scoreWithout);
  });
});

describe('greetingForHour', () => {
  it('greets morning hours (5-11)', () => {
    expect(greetingForHour(5).text).toBe('Good morning');
    expect(greetingForHour(11).text).toBe('Good morning');
  });

  it('greets afternoon hours (12-16)', () => {
    expect(greetingForHour(12).text).toBe('Good afternoon');
    expect(greetingForHour(16).text).toBe('Good afternoon');
  });

  it('greets evening hours (17-20)', () => {
    expect(greetingForHour(17).text).toBe('Good evening');
    expect(greetingForHour(20).text).toBe('Good evening');
  });

  it('greets late-night/early-morning hours as "Good night"', () => {
    expect(greetingForHour(21).text).toBe('Good night');
    expect(greetingForHour(23).text).toBe('Good night');
    expect(greetingForHour(0).text).toBe('Good night');
    expect(greetingForHour(4).text).toBe('Good night');
  });
});

describe('formatHeroDistanceKm', () => {
  it('formats sub-km distances in meters', () => {
    expect(formatHeroDistanceKm(850)).toBe('850 m');
  });

  it('formats km-and-above distances to 2 decimal places', () => {
    expect(formatHeroDistanceKm(2510)).toBe('2.51 km');
  });

  it('rounds meters to a whole number', () => {
    expect(formatHeroDistanceKm(849.6)).toBe('850 m');
  });
});
