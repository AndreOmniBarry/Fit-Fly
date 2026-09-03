import { describe, expect, it } from 'vitest';
import { estimateRunCalories, intensityFromPaceSecPerKm } from '../../../js/features/run/run-calorie-estimate.js';

describe('intensityFromPaceSecPerKm', () => {
  it('falls back to moderate with no pace to judge yet', () => {
    expect(intensityFromPaceSecPerKm(null)).toBe('moderate');
  });

  it('reads a sub-5:00/km pace as vigorous', () => {
    expect(intensityFromPaceSecPerKm(270)).toBe('vigorous'); // 4:30/km
  });

  it('reads exactly 5:00/km as still vigorous (boundary)', () => {
    expect(intensityFromPaceSecPerKm(300)).toBe('vigorous');
  });

  it('reads a steady 6:00/km pace as moderate', () => {
    expect(intensityFromPaceSecPerKm(360)).toBe('moderate');
  });

  it('reads exactly 7:00/km as still moderate (boundary)', () => {
    expect(intensityFromPaceSecPerKm(420)).toBe('moderate');
  });

  it('reads a slow 9:00/km jog as light', () => {
    expect(intensityFromPaceSecPerKm(540)).toBe('light');
  });
});

describe('estimateRunCalories', () => {
  it('returns null with no weight on file — never a fabricated number', () => {
    expect(estimateRunCalories({ durationMs: 30 * 60000, avgPaceSecPerKm: 300, weightKg: undefined })).toBeNull();
  });

  it('estimates real kcal for a 30-minute run at a vigorous pace', () => {
    const result = estimateRunCalories({ durationMs: 30 * 60000, avgPaceSecPerKm: 270, weightKg: 70 });
    expect(result).not.toBeNull();
    expect(result.kcal).toBeGreaterThan(0);
    expect(result.confidence).toBe('medium'); // 'run' is a matched activity type, not 'other'
    expect(result.method).toBe('met-formula');
  });

  it('a faster pace burns more than a slower one over the same duration and weight', () => {
    const fast = estimateRunCalories({ durationMs: 30 * 60000, avgPaceSecPerKm: 270, weightKg: 70 });
    const slow = estimateRunCalories({ durationMs: 30 * 60000, avgPaceSecPerKm: 540, weightKg: 70 });
    expect(fast.kcal).toBeGreaterThan(slow.kcal);
  });

  it('a longer run burns more than a shorter one at the same pace and weight', () => {
    const short = estimateRunCalories({ durationMs: 15 * 60000, avgPaceSecPerKm: 300, weightKg: 70 });
    const long = estimateRunCalories({ durationMs: 45 * 60000, avgPaceSecPerKm: 300, weightKg: 70 });
    expect(long.kcal).toBeGreaterThan(short.kcal);
  });
});
