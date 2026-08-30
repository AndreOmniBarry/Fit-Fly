import { describe, expect, it } from 'vitest';
import {
  activityMultiplierForDays,
  calculateBmr,
  calculateTdee,
  calorieTargetForCategory,
  tdeeConfidenceBand,
} from '../../../js/features/nutrition/bmr-tdee.js';

describe('calculateBmr (Mifflin-St Jeor)', () => {
  it('matches the formula for a man: 10w + 6.25h - 5a + 5', () => {
    // 80kg, 180cm, 30yo man: 800 + 1125 - 150 + 5 = 1780
    expect(calculateBmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });

  it('matches the formula for a woman: 10w + 6.25h - 5a - 161', () => {
    // 65kg, 165cm, 28yo woman: 650 + 1031.25 - 140 - 161 = 1380.25
    expect(calculateBmr({ sex: 'female', weightKg: 65, heightCm: 165, age: 28 })).toBeCloseTo(1380.25, 5);
  });

  it('averages the two sex-specific constants for anything else', () => {
    const base = 10 * 70 + 6.25 * 170 - 5 * 25; // = 1912.5
    const result = calculateBmr({ sex: 'prefer-not-to-say', weightKg: 70, heightCm: 170, age: 25 });
    expect(result).toBeCloseTo(base - 78, 5);
  });

  it('returns null for missing/non-positive inputs', () => {
    expect(calculateBmr({ sex: 'male', weightKg: 0, heightCm: 180, age: 30 })).toBeNull();
    expect(calculateBmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 0 })).toBeNull();
    expect(calculateBmr({ sex: 'male', weightKg: 80, heightCm: 180 })).toBeNull();
  });
});

describe('activityMultiplierForDays', () => {
  it('buckets across the standard tiers', () => {
    expect(activityMultiplierForDays(0)).toBe(1.2);
    expect(activityMultiplierForDays(1)).toBe(1.2);
    expect(activityMultiplierForDays(2)).toBe(1.375);
    expect(activityMultiplierForDays(4)).toBe(1.55);
    expect(activityMultiplierForDays(6)).toBe(1.725);
    expect(activityMultiplierForDays(7)).toBe(1.9);
  });
});

describe('calculateTdee', () => {
  it('is BMR x the activity multiplier', () => {
    expect(calculateTdee(1780, 4)).toBeCloseTo(1780 * 1.55, 5);
  });

  it('is null when BMR is null (propagates the "no basis" signal)', () => {
    expect(calculateTdee(null, 4)).toBeNull();
  });
});

describe('tdeeConfidenceBand', () => {
  it('brackets the central estimate with a +/- margin, rounded to the nearest 10', () => {
    const band = tdeeConfidenceBand(2000, 0.1);
    expect(band.central).toBe(2000);
    expect(band.low).toBe(1800);
    expect(band.high).toBe(2200);
  });

  it('is always "low" confidence — a formula estimate never claims more', () => {
    expect(tdeeConfidenceBand(2000).confidence).toBe('low');
  });

  it('is null when there is no TDEE to bracket', () => {
    expect(tdeeConfidenceBand(null)).toBeNull();
  });
});

describe('calorieTargetForCategory', () => {
  it('applies a deficit for fat loss, a surplus for hypertrophy, maintenance for endurance', () => {
    expect(calorieTargetForCategory(2500, 'cut-fat-loss')).toBe(2000);
    expect(calorieTargetForCategory(2500, 'hypertrophy')).toBe(2750);
    expect(calorieTargetForCategory(2500, 'endurance')).toBe(2500);
  });

  it('is null with no TDEE', () => {
    expect(calorieTargetForCategory(null, 'hypertrophy')).toBeNull();
  });
});
