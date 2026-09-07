import { describe, expect, it } from 'vitest';
import { DEFAULT_PORTION_GRAMS, scalePortion } from '../../../js/features/nutrition/portion-scaling.js';

const OATS_PER_100G = { caloriesPer100g: 389, proteinGPer100g: 17, carbsGPer100g: 66, fatGPer100g: 7, fiberGPer100g: 10 };

describe('scalePortion', () => {
  it('returns the same figures unscaled at the default 100g portion', () => {
    expect(scalePortion(OATS_PER_100G, DEFAULT_PORTION_GRAMS)).toEqual({
      calories: 389,
      proteinG: 17,
      carbsG: 66,
      fatG: 7,
      fiberG: 10,
    });
  });

  it('scales down for a smaller portion', () => {
    expect(scalePortion(OATS_PER_100G, 50)).toEqual({
      calories: 195, // 389 * 0.5 = 194.5 -> rounds to 195
      proteinG: 9, // 8.5 -> 9
      carbsG: 33,
      fatG: 4, // 3.5 -> 4
      fiberG: 5,
    });
  });

  it('scales up for a larger portion', () => {
    expect(scalePortion(OATS_PER_100G, 250)).toEqual({
      calories: 973,
      proteinG: 43,
      carbsG: 165,
      fatG: 18,
      fiberG: 25,
    });
  });

  it('treats a missing fiber figure as 0 rather than NaN', () => {
    const noFiber = { caloriesPer100g: 100, proteinGPer100g: 5, carbsGPer100g: 10, fatGPer100g: 2 };
    expect(scalePortion(noFiber, 100).fiberG).toBe(0);
  });

  it('returns null for a zero, negative, or missing gram amount — never a divide-by-zero guess', () => {
    expect(scalePortion(OATS_PER_100G, 0)).toBeNull();
    expect(scalePortion(OATS_PER_100G, -50)).toBeNull();
    expect(scalePortion(OATS_PER_100G, undefined)).toBeNull();
    expect(scalePortion(OATS_PER_100G, NaN)).toBeNull();
  });

  it('returns null with no base food to scale', () => {
    expect(scalePortion(null, 100)).toBeNull();
  });
});
