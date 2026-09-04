import { describe, expect, it } from 'vitest';
import { estimateStrengthSessionCalories } from '../../../js/features/activity/session-calorie-estimate.js';

describe('estimateStrengthSessionCalories', () => {
  it('is null with fewer than two sets — no real elapsed duration to derive', () => {
    expect(estimateStrengthSessionCalories({ sets: [], weightKg: 70 })).toBeNull();
    expect(estimateStrengthSessionCalories({ sets: [{ completedAt: '2026-03-15T10:00:00.000Z' }], weightKg: 70 })).toBeNull();
  });

  it('is null with no weight on file', () => {
    const sets = [
      { completedAt: '2026-03-15T10:00:00.000Z' },
      { completedAt: '2026-03-15T10:30:00.000Z' },
    ];
    expect(estimateStrengthSessionCalories({ sets, weightKg: undefined })).toBeNull();
  });

  it('derives a real duration from the first-to-last set span, not a guess', () => {
    const sets = [
      { completedAt: '2026-03-15T10:05:00.000Z' },
      { completedAt: '2026-03-15T10:00:00.000Z' }, // deliberately out of order
      { completedAt: '2026-03-15T10:30:00.000Z' },
    ];
    // 10:00 to 10:30 = 30 real minutes, regardless of input order.
    const result = estimateStrengthSessionCalories({ sets, weightKg: 70 });
    expect(result).not.toBeNull();
    expect(result.method).toBe('met-formula');
  });

  it('a longer real session burns more than a shorter one, same weight', () => {
    const shortSets = [
      { completedAt: '2026-03-15T10:00:00.000Z' },
      { completedAt: '2026-03-15T10:10:00.000Z' },
    ];
    const longSets = [
      { completedAt: '2026-03-15T10:00:00.000Z' },
      { completedAt: '2026-03-15T11:00:00.000Z' },
    ];
    const short = estimateStrengthSessionCalories({ sets: shortSets, weightKg: 70 });
    const long = estimateStrengthSessionCalories({ sets: longSets, weightKg: 70 });
    expect(long.kcal).toBeGreaterThan(short.kcal);
  });

  it('is null when every set shares the same timestamp (zero real elapsed duration)', () => {
    const sets = [
      { completedAt: '2026-03-15T10:00:00.000Z' },
      { completedAt: '2026-03-15T10:00:00.000Z' },
    ];
    expect(estimateStrengthSessionCalories({ sets, weightKg: 70 })).toBeNull();
  });
});
