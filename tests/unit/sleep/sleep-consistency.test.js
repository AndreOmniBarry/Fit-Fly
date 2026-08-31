import { describe, expect, it } from 'vitest';
import { calculateSleepConsistency } from '../../../js/features/sleep/sleep-consistency.js';

function log(date, bedTime, durationMinutes = 480) {
  return { date, bedTime, wakeTime: null, durationMinutes, quality: null, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('calculateSleepConsistency', () => {
  it('returns null with fewer than two known bedtimes', () => {
    expect(calculateSleepConsistency([])).toEqual({ score: null, varianceMinutes: null, nightsConsidered: 0 });
    expect(calculateSleepConsistency([log('2024-01-01', '2024-01-01T23:00:00.000Z')])).toEqual({
      score: null,
      varianceMinutes: null,
      nightsConsidered: 1,
    });
  });

  it('scores a dead-even bedtime as perfectly consistent', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z'),
      log('2024-01-02', '2024-01-02T23:00:00.000Z'),
      log('2024-01-03', '2024-01-03T23:00:00.000Z'),
    ];
    const result = calculateSleepConsistency(logs);
    expect(result.score).toBe(100);
    expect(result.varianceMinutes).toBe(0);
    expect(result.nightsConsidered).toBe(3);
  });

  it('handles bedtimes that cross midnight without a fake jump', () => {
    // 23:45 and 00:15 the next calendar night are 30 minutes apart, not
    // ~23.5 hours — the noon-shift trick should keep them close together.
    const logs = [
      log('2024-01-01', '2024-01-01T23:45:00.000Z'),
      log('2024-01-02', '2024-01-03T00:15:00.000Z'),
    ];
    const result = calculateSleepConsistency(logs);
    expect(result.varianceMinutes).toBeLessThan(20);
    expect(result.score).toBeGreaterThan(80);
  });

  it('scores wildly swinging bedtimes low', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T21:00:00.000Z'),
      log('2024-01-02', '2024-01-03T01:30:00.000Z'),
      log('2024-01-03', '2024-01-03T22:00:00.000Z'),
    ];
    const result = calculateSleepConsistency(logs);
    expect(result.score).toBeLessThan(60);
  });

  it('ignores logs with no bedTime rather than crashing on them', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z'),
      log('2024-01-02', null),
      log('2024-01-03', '2024-01-03T23:10:00.000Z'),
    ];
    const result = calculateSleepConsistency(logs);
    expect(result.nightsConsidered).toBe(2);
  });

  it('the score is always between 0 and 100', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T12:00:00.000Z'),
      log('2024-01-02', '2024-01-03T00:00:00.000Z'),
      log('2024-01-03', '2024-01-03T06:00:00.000Z'),
    ];
    const result = calculateSleepConsistency(logs);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
