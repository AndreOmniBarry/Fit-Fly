import { describe, expect, it } from 'vitest';
import { computeSleepLogTimes } from '../../../js/features/sleep/sleep-duration.js';

describe('computeSleepLogTimes', () => {
  it('an ordinary evening bedtime rolls back to the previous calendar day', () => {
    const result = computeSleepLogTimes('2024-01-02', '23:14', '06:56');
    expect(result.bedTime).toBe('2024-01-01T23:14:00.000Z');
    expect(result.wakeTime).toBe('2024-01-02T06:56:00.000Z');
    expect(result.durationMinutes).toBe(462); // 7h42m
  });

  it('a post-midnight bedtime stays on the wake-up date itself', () => {
    const result = computeSleepLogTimes('2024-01-02', '00:30', '07:00');
    expect(result.bedTime).toBe('2024-01-02T00:30:00.000Z');
    expect(result.wakeTime).toBe('2024-01-02T07:00:00.000Z');
    expect(result.durationMinutes).toBe(390); // 6h30m
  });

  it('a bedtime exactly at noon is treated as the previous evening', () => {
    const result = computeSleepLogTimes('2024-01-02', '12:00', '20:00');
    expect(result.bedTime).toBe('2024-01-01T12:00:00.000Z');
  });

  it('handles a month/year rollover correctly', () => {
    const result = computeSleepLogTimes('2024-01-01', '23:00', '07:00');
    expect(result.bedTime).toBe('2023-12-31T23:00:00.000Z');
    expect(result.durationMinutes).toBe(480);
  });

  it('a wake time before an effectively-later bedtime produces a non-positive duration (caller validates)', () => {
    const result = computeSleepLogTimes('2024-01-02', '08:00', '07:00');
    expect(result.durationMinutes).toBeLessThanOrEqual(0);
  });

  it('rejects a malformed date', () => {
    expect(() => computeSleepLogTimes('not-a-date', '23:00', '07:00')).toThrow();
  });

  it('rejects a malformed clock time', () => {
    expect(() => computeSleepLogTimes('2024-01-02', 'nope', '07:00')).toThrow();
  });
});
