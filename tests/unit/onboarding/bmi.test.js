import { describe, expect, it } from 'vitest';
import { calculateBmi, classifyBmi } from '../../../js/features/onboarding/bmi.js';

describe('calculateBmi', () => {
  it('matches the standard formula: kg / m^2', () => {
    // 70kg at 175cm -> 70 / 1.75^2 = 22.857...
    expect(calculateBmi(175, 70)).toBeCloseTo(22.857, 2);
  });

  it('returns null for non-positive or missing inputs', () => {
    expect(calculateBmi(0, 70)).toBeNull();
    expect(calculateBmi(175, 0)).toBeNull();
    expect(calculateBmi(-5, 70)).toBeNull();
    expect(calculateBmi(undefined, 70)).toBeNull();
  });
});

describe('classifyBmi', () => {
  it('buckets across the WHO cutoffs', () => {
    expect(classifyBmi(17)).toBe('below-typical');
    expect(classifyBmi(18.5)).toBe('typical'); // boundary is inclusive on the upper side
    expect(classifyBmi(22)).toBe('typical');
    expect(classifyBmi(25)).toBe('above-typical');
    expect(classifyBmi(29.9)).toBe('above-typical');
    expect(classifyBmi(30)).toBe('well-above-typical');
    expect(classifyBmi(40)).toBe('well-above-typical');
  });

  it('returns null for null/NaN', () => {
    expect(classifyBmi(null)).toBeNull();
    expect(classifyBmi(NaN)).toBeNull();
  });
});
