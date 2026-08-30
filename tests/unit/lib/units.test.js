import { describe, expect, it } from 'vitest';
import {
  cmToFeetInches,
  cmToIn,
  feetInchesToCm,
  inToCm,
  kgToLb,
  lbToKg,
} from '../../../js/lib/units.js';

describe('weight conversions', () => {
  it('round-trips kg <-> lb', () => {
    expect(kgToLb(70)).toBeCloseTo(154.324, 2);
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 9);
  });
});

describe('length conversions', () => {
  it('round-trips cm <-> in', () => {
    expect(cmToIn(180)).toBeCloseTo(70.866, 2);
    expect(inToCm(cmToIn(180))).toBeCloseTo(180, 9);
  });

  it('splits cm into feet + inches', () => {
    // 180cm = 70.8661... in = 5ft (60in) + 10.8661...in
    const { feet, inches } = cmToFeetInches(180);
    expect(feet).toBe(5);
    expect(inches).toBeCloseTo(10.866, 2);
  });

  it('feetInchesToCm is the inverse of cmToFeetInches', () => {
    const { feet, inches } = cmToFeetInches(175);
    expect(feetInchesToCm(feet, inches)).toBeCloseTo(175, 9);
  });
});
