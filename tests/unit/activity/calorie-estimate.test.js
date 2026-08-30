import { describe, expect, it } from 'vitest';
import { estimateActivityCalories } from '../../../js/features/activity/calorie-estimate.js';

describe('estimateActivityCalories', () => {
  it('applies the standard MET formula: kcal/min = MET x 3.5 x kg / 200', () => {
    // run (MET 9.8) x moderate (x1.0) x 70kg x 30min
    // kcal/min = 9.8 * 3.5 * 70 / 200 = 12.005 -> * 30 = 360.15 -> rounds to 360
    const result = estimateActivityCalories({
      activityTypeId: 'run',
      intensityId: 'moderate',
      durationMinutes: 30,
      weightKg: 70,
    });
    expect(result.kcal).toBe(360);
    expect(result.method).toBe('met-formula');
  });

  it('rounds to the nearest 5 kcal, never a false-precise decimal', () => {
    const result = estimateActivityCalories({
      activityTypeId: 'walk',
      intensityId: 'light',
      durationMinutes: 17,
      weightKg: 63,
    });
    expect(Number.isInteger(result.kcal)).toBe(true);
    expect(result.kcal % 5).toBe(0);
  });

  it('a more vigorous intensity burns more than a lighter one, same activity/duration/weight', () => {
    const base = { activityTypeId: 'cycle', durationMinutes: 30, weightKg: 75 };
    const light = estimateActivityCalories({ ...base, intensityId: 'light' });
    const vigorous = estimateActivityCalories({ ...base, intensityId: 'vigorous' });
    expect(vigorous.kcal).toBeGreaterThan(light.kcal);
  });

  it('is always labeled an estimate, never "high" confidence (no sensor backs this number)', () => {
    const result = estimateActivityCalories({
      activityTypeId: 'run',
      intensityId: 'moderate',
      durationMinutes: 30,
      weightKg: 70,
    });
    expect(['low', 'medium']).toContain(result.confidence);
  });

  it('"other" activity gets low confidence; a matched activity gets medium', () => {
    const shared = { intensityId: 'moderate', durationMinutes: 30, weightKg: 70 };
    expect(estimateActivityCalories({ ...shared, activityTypeId: 'other' }).confidence).toBe('low');
    expect(estimateActivityCalories({ ...shared, activityTypeId: 'run' }).confidence).toBe('medium');
  });

  it('returns null for an unknown activity/intensity id or non-positive inputs', () => {
    const valid = { activityTypeId: 'run', intensityId: 'moderate', durationMinutes: 30, weightKg: 70 };
    expect(estimateActivityCalories({ ...valid, activityTypeId: 'not-real' })).toBeNull();
    expect(estimateActivityCalories({ ...valid, intensityId: 'not-real' })).toBeNull();
    expect(estimateActivityCalories({ ...valid, durationMinutes: 0 })).toBeNull();
    expect(estimateActivityCalories({ ...valid, weightKg: -5 })).toBeNull();
  });
});
