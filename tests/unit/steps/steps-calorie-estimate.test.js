import { describe, expect, it } from 'vitest';
import { estimateStepsCalories } from '../../../js/features/steps/steps-calorie-estimate.js';
import { estimateActivityCalories } from '../../../js/features/activity/calorie-estimate.js';

describe('estimateStepsCalories', () => {
  it('is null for zero or negative steps — never a fabricated number for a day nothing was logged', () => {
    expect(estimateStepsCalories({ steps: 0, weightKg: 70 })).toBeNull();
    expect(estimateStepsCalories({ steps: -5, weightKg: 70 })).toBeNull();
  });

  it('is null with no weight on file, same as every other calorie estimate in this app', () => {
    expect(estimateStepsCalories({ steps: 8000, weightKg: undefined })).toBeNull();
  });

  it('matches calling the shared MET-formula estimator directly with the derived duration (100 steps/min)', () => {
    const steps = 10000;
    const weightKg = 70;
    const result = estimateStepsCalories({ steps, weightKg });
    const expected = estimateActivityCalories({
      activityTypeId: 'walk',
      intensityId: 'moderate',
      durationMinutes: steps / 100,
      weightKg,
    });
    expect(result).toEqual(expected);
  });

  it('more steps burns more calories, same weight', () => {
    const low = estimateStepsCalories({ steps: 3000, weightKg: 70 });
    const high = estimateStepsCalories({ steps: 12000, weightKg: 70 });
    expect(high.kcal).toBeGreaterThan(low.kcal);
  });

  it('is always labeled an estimate, never a false-precise or measured number', () => {
    const result = estimateStepsCalories({ steps: 8000, weightKg: 70 });
    expect(['low', 'medium']).toContain(result.confidence);
    expect(result.method).toBe('met-formula');
  });
});
