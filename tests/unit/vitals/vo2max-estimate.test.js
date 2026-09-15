import { describe, expect, it } from 'vitest';
import {
  estimateVo2maxCooper,
  estimateVo2maxRockport,
  ROCKPORT_STANDARD_ERROR_ML_KG_MIN,
} from '../../../js/features/vitals/vo2max-estimate.js';

describe('estimateVo2maxCooper', () => {
  it('returns null for a zero or missing distance', () => {
    expect(estimateVo2maxCooper(0)).toBeNull();
    expect(estimateVo2maxCooper(-100)).toBeNull();
  });

  it('computes the real Cooper (1968) regression: (distance - 504.9) / 44.73', () => {
    // 2400m in 12 minutes — a common real Cooper-test result.
    const result = estimateVo2maxCooper(2400);
    expect(result.protocol).toBe('cooper');
    expect(result.vo2max).toBeCloseTo((2400 - 504.9) / 44.73, 1);
  });

  it('rounds to one decimal place', () => {
    const result = estimateVo2maxCooper(3000);
    expect(Number.isInteger(result.vo2max * 10)).toBe(true);
  });
});

describe('estimateVo2maxRockport', () => {
  const baseInput = { weightKg: 70, ageYears: 30, sex: 'male', timeMinutes: 13, heartRateBpm: 140 };

  it('returns null when any required input is missing or non-positive', () => {
    expect(estimateVo2maxRockport({ ...baseInput, weightKg: 0 })).toBeNull();
    expect(estimateVo2maxRockport({ ...baseInput, ageYears: 0 })).toBeNull();
    expect(estimateVo2maxRockport({ ...baseInput, timeMinutes: 0 })).toBeNull();
    expect(estimateVo2maxRockport({ ...baseInput, heartRateBpm: 0 })).toBeNull();
  });

  it('computes the real Kline et al. (1987) regression for a male', () => {
    // weightLb = 70 / 0.45359237 = 154.324...
    const weightLb = 70 / 0.45359237;
    const expected =
      132.853 - 0.0769 * weightLb - 0.3877 * 30 + 6.315 - 3.2649 * 13 - 0.1565 * 140;
    const result = estimateVo2maxRockport(baseInput);
    expect(result.protocol).toBe('rockport');
    expect(result.vo2max).toBeCloseTo(expected, 1);
  });

  it('applies zero sex-coefficient for a female (never the male +6.315 term)', () => {
    const male = estimateVo2maxRockport(baseInput);
    const female = estimateVo2maxRockport({ ...baseInput, sex: 'female' });
    expect(male.vo2max - female.vo2max).toBeCloseTo(6.315, 1);
  });

  it('a slower time and higher heart rate lower the estimate (both real predictors of lower fitness)', () => {
    const fit = estimateVo2maxRockport(baseInput);
    const lessFit = estimateVo2maxRockport({ ...baseInput, timeMinutes: 20, heartRateBpm: 170 });
    expect(lessFit.vo2max).toBeLessThan(fit.vo2max);
  });

  it('returns null rather than a negative VO2max for wildly implausible inputs', () => {
    const result = estimateVo2maxRockport({
      weightKg: 150,
      ageYears: 89,
      sex: 'female',
      timeMinutes: 40,
      heartRateBpm: 195,
    });
    expect(result).toBeNull();
  });

  it('exposes the real Kline et al. standard error of estimate', () => {
    expect(ROCKPORT_STANDARD_ERROR_ML_KG_MIN).toBe(5.0);
  });
});
