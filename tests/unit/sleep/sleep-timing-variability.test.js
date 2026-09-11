import { describe, expect, it } from 'vitest';
import { calculateSleepTimingVariability } from '../../../js/features/sleep/sleep-timing-variability.js';

function log(date, bedTime, durationMinutes = 480) {
  return { date, bedTime, wakeTime: null, durationMinutes, quality: null, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('calculateSleepTimingVariability', () => {
  it('returns null with fewer than two known midpoints', () => {
    expect(calculateSleepTimingVariability([])).toEqual({
      stdDevMinutes: null,
      nightsConsidered: 0,
      elevated: false,
    });
    expect(calculateSleepTimingVariability([log('2024-01-01', '2024-01-01T23:00:00.000Z')])).toEqual({
      stdDevMinutes: null,
      nightsConsidered: 1,
      elevated: false,
    });
  });

  it('scores an identical bedtime and duration every night as zero swing', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z', 480),
      log('2024-01-02', '2024-01-02T23:00:00.000Z', 480),
      log('2024-01-03', '2024-01-03T23:00:00.000Z', 480),
    ];
    const result = calculateSleepTimingVariability(logs);
    expect(result.stdDevMinutes).toBe(0);
    expect(result.elevated).toBe(false);
    expect(result.nightsConsidered).toBe(3);
  });

  it('catches midpoint swing from duration alone, even with a dead-steady bedtime', () => {
    // Same 23:00 bedtime every night — sleep-consistency.ts's bedtime-only
    // score would read this as perfectly consistent — but duration swings
    // 6h/8h/10h, so the *midpoint* (when the night's sleep is centered)
    // still moves a real amount. This is exactly the case this metric
    // exists to catch that bedtime-only consistency can't.
    const logs = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z', 360),
      log('2024-01-02', '2024-01-02T23:00:00.000Z', 480),
      log('2024-01-03', '2024-01-03T23:00:00.000Z', 600),
    ];
    const result = calculateSleepTimingVariability(logs);
    expect(result.stdDevMinutes).toBe(49);
    expect(result.elevated).toBe(false);
  });

  it('handles a midpoint that crosses midnight without a fake jump', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T23:45:00.000Z'),
      log('2024-01-02', '2024-01-03T00:15:00.000Z'),
    ];
    const result = calculateSleepTimingVariability(logs);
    expect(result.stdDevMinutes).toBeLessThan(20);
    expect(result.elevated).toBe(false);
  });

  it('flags wildly swinging bedtimes as elevated', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T21:00:00.000Z'),
      log('2024-01-02', '2024-01-03T01:30:00.000Z'),
      log('2024-01-03', '2024-01-03T22:00:00.000Z'),
    ];
    const result = calculateSleepTimingVariability(logs);
    expect(result.stdDevMinutes).toBeGreaterThan(90);
    expect(result.elevated).toBe(true);
  });

  it('ignores logs with no bedTime rather than crashing on them', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z'),
      log('2024-01-02', null),
      log('2024-01-03', '2024-01-03T23:10:00.000Z'),
    ];
    const result = calculateSleepTimingVariability(logs);
    expect(result.nightsConsidered).toBe(2);
  });

  it('stdDevMinutes is never negative', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T12:00:00.000Z', 300),
      log('2024-01-02', '2024-01-03T00:00:00.000Z', 600),
      log('2024-01-03', '2024-01-03T06:00:00.000Z', 420),
    ];
    const result = calculateSleepTimingVariability(logs);
    expect(result.stdDevMinutes).toBeGreaterThanOrEqual(0);
  });
});
