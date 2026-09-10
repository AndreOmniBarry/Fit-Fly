import { describe, expect, it } from 'vitest';
import { createPrng } from '../../../js/features/focus/prng.js';
import { generateWanderCurve, sampleWanderCurve } from '../../../js/features/focus/wander.js';

const OCEAN_OPTIONS = { minValue: 0.5, maxValue: 1, minSegmentSeconds: 4, maxSegmentSeconds: 7 };

describe('generateWanderCurve', () => {
  it('the first breakpoint sits at t=0 with the given start value', () => {
    const curve = generateWanderCurve(20, OCEAN_OPTIONS, 0.8, createPrng(1));
    expect(curve[0]).toEqual({ timeSeconds: 0, value: 0.8 });
  });

  it('clamps an out-of-range start value into [minValue, maxValue]', () => {
    const tooHigh = generateWanderCurve(20, OCEAN_OPTIONS, 5, createPrng(1));
    expect(tooHigh[0].value).toBe(1);
    const tooLow = generateWanderCurve(20, OCEAN_OPTIONS, -5, createPrng(1));
    expect(tooLow[0].value).toBe(0.5);
  });

  it('covers at least the requested duration — a caller never runs out of curve early', () => {
    const curve = generateWanderCurve(20, OCEAN_OPTIONS, 0.8, createPrng(2));
    const last = curve[curve.length - 1];
    expect(last.timeSeconds).toBeGreaterThanOrEqual(20);
  });

  it('every breakpoint after the first has a real, non-decreasing time and an in-range value', () => {
    const curve = generateWanderCurve(30, OCEAN_OPTIONS, 0.8, createPrng(3));
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].timeSeconds).toBeGreaterThan(curve[i - 1].timeSeconds);
      expect(curve[i].value).toBeGreaterThanOrEqual(OCEAN_OPTIONS.minValue);
      expect(curve[i].value).toBeLessThanOrEqual(OCEAN_OPTIONS.maxValue);
    }
  });

  it('segment gaps stay within the declared min/max range', () => {
    const curve = generateWanderCurve(60, OCEAN_OPTIONS, 0.8, createPrng(4));
    for (let i = 1; i < curve.length; i++) {
      const gap = curve[i].timeSeconds - curve[i - 1].timeSeconds;
      expect(gap).toBeGreaterThanOrEqual(OCEAN_OPTIONS.minSegmentSeconds);
      expect(gap).toBeLessThanOrEqual(OCEAN_OPTIONS.maxSegmentSeconds);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateWanderCurve(30, OCEAN_OPTIONS, 0.8, createPrng(9));
    const b = generateWanderCurve(30, OCEAN_OPTIONS, 0.8, createPrng(9));
    expect(a).toEqual(b);
  });

  it('is genuinely irregular, not a fixed period — real variance across segment gaps', () => {
    const curve = generateWanderCurve(120, OCEAN_OPTIONS, 0.8, createPrng(5));
    const gaps = curve.slice(1).map((bp, i) => bp.timeSeconds - curve[i].timeSeconds);
    const uniqueGaps = new Set(gaps.map((g) => g.toFixed(4))).size;
    expect(uniqueGaps).toBeGreaterThan(gaps.length * 0.8);
  });
});

describe('sampleWanderCurve', () => {
  it('returns the exact value at a real breakpoint', () => {
    const curve = generateWanderCurve(30, OCEAN_OPTIONS, 0.8, createPrng(6));
    for (const bp of curve) {
      expect(sampleWanderCurve(curve, bp.timeSeconds)).toBeCloseTo(bp.value, 10);
    }
  });

  it('interpolates linearly at the real midpoint between two breakpoints', () => {
    const curve = [
      { timeSeconds: 0, value: 0 },
      { timeSeconds: 10, value: 1 },
    ];
    expect(sampleWanderCurve(curve, 5)).toBeCloseTo(0.5, 10);
    expect(sampleWanderCurve(curve, 2.5)).toBeCloseTo(0.25, 10);
  });

  it('clamps before the first and after the last breakpoint rather than extrapolating', () => {
    const curve = [
      { timeSeconds: 5, value: 0.3 },
      { timeSeconds: 15, value: 0.9 },
    ];
    expect(sampleWanderCurve(curve, 0)).toBe(0.3);
    expect(sampleWanderCurve(curve, 100)).toBe(0.9);
  });

  it('is honest about an empty curve — 0, not a crash', () => {
    expect(sampleWanderCurve([], 5)).toBe(0);
  });
});
