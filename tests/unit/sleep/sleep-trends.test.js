import { describe, expect, it } from 'vitest';
import { buildWeeklyTrend, calculateLoggingStreak } from '../../../js/features/sleep/sleep-trends.js';

function log(date, durationMinutes) {
  return { date, bedTime: null, wakeTime: null, durationMinutes, quality: null, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('buildWeeklyTrend', () => {
  it('sorts oldest to newest regardless of input order', () => {
    const trend = buildWeeklyTrend([log('2024-01-03', 400), log('2024-01-01', 420), log('2024-01-02', 410)]);
    expect(trend.map((n) => n.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('flags the single longest night as best', () => {
    const trend = buildWeeklyTrend([log('2024-01-01', 400), log('2024-01-02', 500), log('2024-01-03', 420)]);
    expect(trend.filter((n) => n.isBest)).toHaveLength(1);
    expect(trend.find((n) => n.isBest)?.date).toBe('2024-01-02');
  });

  it('breaks an exact tie by picking the earlier night', () => {
    const trend = buildWeeklyTrend([log('2024-01-01', 480), log('2024-01-02', 480)]);
    expect(trend.filter((n) => n.isBest)).toHaveLength(1);
    expect(trend.find((n) => n.isBest)?.date).toBe('2024-01-01');
  });

  it('returns an empty array for no logs', () => {
    expect(buildWeeklyTrend([])).toEqual([]);
  });
});

describe('calculateLoggingStreak', () => {
  it('zero logs is a zero streak', () => {
    expect(calculateLoggingStreak([])).toBe(0);
  });

  it('counts consecutive calendar days ending at the latest log', () => {
    const logs = [log('2024-01-01', 480), log('2024-01-02', 480), log('2024-01-03', 480)];
    expect(calculateLoggingStreak(logs)).toBe(3);
  });

  it('stops counting at the first gap', () => {
    const logs = [log('2024-01-01', 480), log('2024-01-03', 480), log('2024-01-04', 480)];
    expect(calculateLoggingStreak(logs)).toBe(2); // 01-03 and 01-04 only, 01-01 is across the gap
  });

  it('a single log is a streak of one', () => {
    expect(calculateLoggingStreak([log('2024-01-01', 480)])).toBe(1);
  });

  it('a duplicate date for the same night does not inflate the streak', () => {
    const logs = [log('2024-01-01', 480), log('2024-01-01', 480), log('2024-01-02', 480)];
    expect(calculateLoggingStreak(logs)).toBe(2);
  });
});
