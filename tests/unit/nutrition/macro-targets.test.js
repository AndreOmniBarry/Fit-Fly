import { describe, expect, it } from 'vitest';
import { calculateMacroTargets } from '../../../js/features/nutrition/macro-targets.js';

describe('calculateMacroTargets', () => {
  it('scales protein by bodyweight and category', () => {
    const cut = calculateMacroTargets({ calorieTarget: 2000, weightKg: 70, category: 'cut-fat-loss' });
    expect(cut.proteinG).toBe(140); // 2.0 g/kg x 70kg
  });

  it('fat is ~30% of total calories', () => {
    const result = calculateMacroTargets({ calorieTarget: 2000, weightKg: 70, category: 'endurance' });
    expect(result.fatG).toBe(Math.round((2000 * 0.3) / 9));
  });

  it('carbs fill whatever calories remain after protein and fat', () => {
    const result = calculateMacroTargets({ calorieTarget: 2500, weightKg: 80, category: 'hypertrophy' });
    const proteinCalories = result.proteinG * 4;
    const fatCalories = result.fatG * 9;
    const carbsCalories = result.carbsG * 4;
    expect(proteinCalories + fatCalories + carbsCalories).toBeCloseTo(2500, -1); // within ~10 kcal of the target after rounding
  });

  it('never goes negative on carbs even with a very low target and a high protein/fat floor', () => {
    const result = calculateMacroTargets({ calorieTarget: 800, weightKg: 100, category: 'cut-fat-loss' });
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('falls back to a reasonable default protein rate for an unrecognized category', () => {
    const result = calculateMacroTargets({ calorieTarget: 2000, weightKg: 70, category: 'not-a-real-category' });
    expect(result.proteinG).toBe(Math.round(1.4 * 70));
  });

  it('returns null without a calorie target or bodyweight', () => {
    expect(calculateMacroTargets({ calorieTarget: null, weightKg: 70, category: 'endurance' })).toBeNull();
    expect(calculateMacroTargets({ calorieTarget: 2000, weightKg: 0, category: 'endurance' })).toBeNull();
  });
});
