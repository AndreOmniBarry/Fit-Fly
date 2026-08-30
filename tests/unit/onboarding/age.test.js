import { describe, expect, it } from 'vitest';
import { calculateAge } from '../../../js/features/onboarding/age.js';

describe('calculateAge', () => {
  it('computes whole years when the birthday already happened this year', () => {
    expect(calculateAge('1990-01-15', '2026-08-30')).toBe(36);
  });

  it('has not yet incremented if the birthday has not happened this year', () => {
    expect(calculateAge('1990-12-25', '2026-08-30')).toBe(35);
  });

  it('turns a year older exactly on the birthday', () => {
    expect(calculateAge('1990-08-30', '2026-08-30')).toBe(36);
    expect(calculateAge('1990-08-31', '2026-08-30')).toBe(35);
  });

  it('defaults the reference date to now', () => {
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setUTCFullYear(eighteenYearsAgo.getUTCFullYear() - 18);
    expect(calculateAge(eighteenYearsAgo.toISOString())).toBe(18);
  });
});
