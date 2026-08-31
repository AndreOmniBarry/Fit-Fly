import { describe, expect, it } from 'vitest';
import { createPrng } from '../../../js/features/focus/prng.js';
import { generateThunderclapBurst, randomThunderclapDuration } from '../../../js/features/focus/thunder.js';

describe('randomThunderclapDuration', () => {
  it('stays within the declared 0.6-1.4s range', () => {
    const rng = createPrng(1);
    for (let i = 0; i < 200; i++) {
      const d = randomThunderclapDuration(rng);
      expect(d).toBeGreaterThanOrEqual(0.6);
      expect(d).toBeLessThanOrEqual(1.4);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(randomThunderclapDuration(createPrng(5))).toBe(randomThunderclapDuration(createPrng(5)));
  });
});

describe('generateThunderclapBurst', () => {
  it('produces sampleRate * durationSeconds samples', () => {
    const burst = generateThunderclapBurst(48000, 1, createPrng(1));
    expect(burst).toHaveLength(48000);
  });

  it('stays within [-1, 1]', () => {
    const burst = generateThunderclapBurst(48000, 1, createPrng(1));
    for (const v of burst) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('the crack hits near full amplitude almost immediately, not a slow fade-in', () => {
    const burst = generateThunderclapBurst(48000, 1, createPrng(2));
    const earlyPeak = Math.max(...Array.from(burst.slice(0, 2000)).map(Math.abs));
    expect(earlyPeak).toBeGreaterThan(0.5);
  });

  it('decays overall — the final tenth carries much less energy than the first tenth', () => {
    const burst = generateThunderclapBurst(48000, 1, createPrng(3));
    const rms = (buf) => Math.sqrt(Array.from(buf).reduce((sum, v) => sum + v * v, 0) / buf.length);
    const tenth = Math.floor(burst.length / 10);
    expect(rms(burst.slice(-tenth))).toBeLessThan(rms(burst.slice(0, tenth)));
  });

  it('is deterministic for the same seed', () => {
    const a = generateThunderclapBurst(48000, 0.8, createPrng(9));
    const b = generateThunderclapBurst(48000, 0.8, createPrng(9));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('never produces NaN or Infinity', () => {
    const burst = generateThunderclapBurst(48000, 1, createPrng(1));
    expect(burst.some((v) => !Number.isFinite(v))).toBe(false);
  });
});
