import { describe, expect, it } from 'vitest';
import { bestEstimatedOneRepMax, estimateOneRepMax } from '../../../js/features/programs/one-rep-max.js';

describe('estimateOneRepMax (Epley formula)', () => {
  it('a single rep at a weight is exactly that weight, not an inflated estimate', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('matches the Epley formula: weight x (1 + reps/30)', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 6);
    expect(estimateOneRepMax(60, 10)).toBeCloseTo(60 * (1 + 10 / 30), 6);
  });

  it('more reps at the same weight estimates a higher max', () => {
    expect(estimateOneRepMax(80, 8)).toBeGreaterThan(estimateOneRepMax(80, 3));
  });

  it('returns null for non-positive weight, non-positive reps, or a fractional rep count', () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(-10, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(100, 5.5)).toBeNull();
  });
});

describe('bestEstimatedOneRepMax', () => {
  it('picks the highest estimate across sets, not the most recent or heaviest raw weight', () => {
    const sets = [
      { weightKg: 100, reps: 1 }, // estimate: 100
      { weightKg: 80, reps: 10 }, // estimate: 80 * 1.333 = 106.67 — higher despite lighter weight
      { weightKg: 90, reps: 3 }, // estimate: 99
    ];
    expect(bestEstimatedOneRepMax(sets)).toBeCloseTo(80 * (1 + 10 / 30), 6);
  });

  it('ignores invalid sets mixed in with valid ones', () => {
    const sets = [{ weightKg: 0, reps: 5 }, { weightKg: 100, reps: 5 }];
    expect(bestEstimatedOneRepMax(sets)).toBeCloseTo(estimateOneRepMax(100, 5), 6);
  });

  it('is null for an empty list or a list with nothing valid', () => {
    expect(bestEstimatedOneRepMax([])).toBeNull();
    expect(bestEstimatedOneRepMax([{ weightKg: 0, reps: 5 }])).toBeNull();
  });
});
