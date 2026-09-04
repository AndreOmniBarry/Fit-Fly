import { describe, expect, it } from 'vitest';
import { calculateRmssd } from '../../../js/features/heart-rate/hrv.js';

describe('calculateRmssd', () => {
  it('is null with too few intervals accumulated to mean anything', () => {
    expect(calculateRmssd([])).toBeNull();
    expect(calculateRmssd([800, 810, 795])).toBeNull(); // well under the real floor
  });

  it('is 0 for a perfectly regular pulse — zero variability is a real, valid result', () => {
    const intervals = Array(11).fill(800);
    expect(calculateRmssd(intervals)).toBe(0);
  });

  it('computes the real root-mean-square of successive differences', () => {
    // Two alternating values 800/850 -> every successive diff is 50ms,
    // so RMSSD is exactly 50.
    const intervals = [];
    for (let i = 0; i < 12; i++) intervals.push(i % 2 === 0 ? 800 : 850);
    expect(calculateRmssd(intervals)).toBe(50);
  });

  it('a hand-computed known case matches exactly', () => {
    // diffs: 20, -30, 40, -10, 10, 5, -15, 25, -20, 15 (10 diffs, 11 intervals)
    const intervals = [800, 820, 790, 830, 820, 830, 835, 820, 845, 825, 840];
    // squared diffs: 400,900,1600,100,100,25,225,625,400,225 -> sum=4600, mean=460
    const expected = Math.round(Math.sqrt(460));
    expect(calculateRmssd(intervals)).toBe(expected);
  });

  it('requires strictly more than 10 intervals — 10 alone (9 diffs) is not enough', () => {
    const intervals = Array(10).fill(800);
    expect(calculateRmssd(intervals)).toBeNull();
  });
});
