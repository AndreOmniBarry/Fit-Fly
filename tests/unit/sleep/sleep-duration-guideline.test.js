import { describe, expect, it } from 'vitest';
import {
  durationBandForAge,
  GENERAL_ADULT_BAND,
  scoreDurationAgainstBand,
} from '../../../js/features/sleep/sleep-duration-guideline.js';

describe('durationBandForAge', () => {
  it('falls back to the general-adult band when age is unknown', () => {
    expect(durationBandForAge(null)).toBe(GENERAL_ADULT_BAND);
  });

  it('picks young-adult, adult, and older-adult bands at the right boundaries', () => {
    expect(durationBandForAge(18).label).toContain('young adult');
    expect(durationBandForAge(25).label).toContain('young adult');
    expect(durationBandForAge(26).label).toBe('adult (26-64)');
    expect(durationBandForAge(64).label).toBe('adult (26-64)');
    expect(durationBandForAge(65).label).toContain('older adult');
    expect(durationBandForAge(90).label).toContain('older adult');
  });

  it('every adult band agrees on the same 7h recommended minimum', () => {
    // The one invariant sleep-debt.ts's DEFAULT_SLEEP_GOAL_MINUTES relies
    // on — see its own comment for why that's safe without threading age
    // through debt calculations.
    expect(durationBandForAge(20).recommendedMinHours).toBe(7);
    expect(durationBandForAge(40).recommendedMinHours).toBe(7);
    expect(durationBandForAge(70).recommendedMinHours).toBe(7);
  });
});

describe('scoreDurationAgainstBand', () => {
  const band = GENERAL_ADULT_BAND; // recommended 7-9h, may-be-appropriate 6-10h

  it('scores 100 anywhere inside the recommended range', () => {
    expect(scoreDurationAgainstBand(7 * 60, band)).toBe(100);
    expect(scoreDurationAgainstBand(8 * 60, band)).toBe(100);
    expect(scoreDurationAgainstBand(9 * 60, band)).toBe(100);
  });

  it('is NOT simply "more sleep is always better" — 11h scores below 8h', () => {
    const eightHours = scoreDurationAgainstBand(8 * 60, band);
    const elevenHours = scoreDurationAgainstBand(11 * 60, band);
    expect(elevenHours).toBeLessThan(eightHours);
  });

  it('tapers symmetrically-in-spirit on both sides — 5h and 11h (each 2h past the recommended edge in one direction) both score below 100 and above 0', () => {
    const short = scoreDurationAgainstBand(5 * 60, band);
    const long = scoreDurationAgainstBand(11 * 60, band);
    expect(short).toBeLessThan(100);
    expect(short).toBeGreaterThan(0);
    expect(long).toBeLessThan(100);
    expect(long).toBeGreaterThan(0);
  });

  it('is monotonic within the short-of-recommended taper', () => {
    const veryShort = scoreDurationAgainstBand(3 * 60, band);
    const short = scoreDurationAgainstBand(6 * 60, band);
    const almostEnough = scoreDurationAgainstBand(6.5 * 60, band);
    expect(short).toBeGreaterThan(veryShort);
    expect(almostEnough).toBeGreaterThan(short);
  });

  it('is monotonic within the over-recommended taper', () => {
    const bitOver = scoreDurationAgainstBand(9.5 * 60, band);
    const wayOver = scoreDurationAgainstBand(12 * 60, band);
    expect(bitOver).toBeLessThan(100);
    expect(wayOver).toBeLessThan(bitOver);
  });

  it('never goes below 0 or above 100, even at extremes', () => {
    expect(scoreDurationAgainstBand(0, band)).toBeGreaterThanOrEqual(0);
    expect(scoreDurationAgainstBand(20 * 60, band)).toBeGreaterThanOrEqual(0);
    expect(scoreDurationAgainstBand(20 * 60, band)).toBeLessThanOrEqual(100);
  });

  it("an older adult's tighter recommended max scores 9h lower than a young adult's, all else equal", () => {
    const olderScore = scoreDurationAgainstBand(9 * 60, durationBandForAge(70));
    const youngScore = scoreDurationAgainstBand(9 * 60, durationBandForAge(20));
    expect(olderScore).toBeLessThan(youngScore);
  });
});
