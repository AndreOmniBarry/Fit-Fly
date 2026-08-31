import { describe, expect, it } from 'vitest';
import { createPrng } from '../../../js/features/calm-sounds/prng.js';
import {
  crossfadeLoopBuffer,
  generateBrownNoise,
  generatePinkNoise,
  generateWhiteNoise,
} from '../../../js/features/calm-sounds/noise-synthesis.js';

function rms(buffer) {
  return Math.sqrt(Array.from(buffer).reduce((sum, v) => sum + v * v, 0) / buffer.length);
}

describe.each([
  ['generateWhiteNoise', generateWhiteNoise],
  ['generatePinkNoise', generatePinkNoise],
  ['generateBrownNoise', generateBrownNoise],
])('%s', (_name, generate) => {
  it('produces the requested length', () => {
    expect(generate(1000, createPrng(1))).toHaveLength(1000);
  });

  it('stays within [-1, 1]', () => {
    const buffer = generate(5000, createPrng(1));
    for (const v of buffer) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generate(500, createPrng(99));
    const b = generate(500, createPrng(99));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is not silent', () => {
    const buffer = generate(4000, createPrng(1));
    expect(rms(buffer)).toBeGreaterThan(0.01);
  });
});

describe('spectral character (rough, not exact — just "these are audibly different")', () => {
  it('brown noise has more low-frequency energy than white noise, sample-to-sample', () => {
    // A cheap proxy for "low-passed": brown noise moves less between
    // consecutive samples than white noise does.
    const white = generateWhiteNoise(4000, createPrng(3));
    const brown = generateBrownNoise(4000, createPrng(3));

    const avgStep = (buf) => {
      let total = 0;
      for (let i = 1; i < buf.length; i++) total += Math.abs(buf[i] - buf[i - 1]);
      return total / (buf.length - 1);
    };

    expect(avgStep(brown)).toBeLessThan(avgStep(white));
  });

  it('pink noise sits between white and brown in sample-to-sample smoothness', () => {
    const white = generateWhiteNoise(4000, createPrng(3));
    const pink = generatePinkNoise(4000, createPrng(3));
    const brown = generateBrownNoise(4000, createPrng(3));

    const avgStep = (buf) => {
      let total = 0;
      for (let i = 1; i < buf.length; i++) total += Math.abs(buf[i] - buf[i - 1]);
      return total / (buf.length - 1);
    };

    expect(avgStep(brown)).toBeLessThan(avgStep(pink));
    expect(avgStep(pink)).toBeLessThan(avgStep(white));
  });
});

describe('crossfadeLoopBuffer', () => {
  it('keeps the buffer length unchanged', () => {
    const buffer = generateWhiteNoise(1000, createPrng(1));
    expect(crossfadeLoopBuffer(buffer, 100)).toHaveLength(1000);
  });

  it('sample 0 becomes exactly the original tail sample (fade weight 0 at the very start)', () => {
    const buffer = generateWhiteNoise(1000, createPrng(1));
    const out = crossfadeLoopBuffer(buffer, 100);
    expect(out[0]).toBeCloseTo(buffer[900], 10);
  });

  it('the last fade sample stays close to the original head (fade weight ~1 by the end)', () => {
    const buffer = generateWhiteNoise(1000, createPrng(1));
    const out = crossfadeLoopBuffer(buffer, 100);
    expect(out[99]).toBeCloseTo(buffer[99], 1);
  });

  it('leaves samples outside the fade window untouched', () => {
    const buffer = generateWhiteNoise(1000, createPrng(1));
    const out = crossfadeLoopBuffer(buffer, 100);
    expect(Array.from(out.slice(100))).toEqual(Array.from(buffer.slice(100)));
  });

  it('clamps an oversized fade window to half the buffer instead of throwing', () => {
    const buffer = generateWhiteNoise(100, createPrng(1));
    expect(() => crossfadeLoopBuffer(buffer, 10_000)).not.toThrow();
    expect(crossfadeLoopBuffer(buffer, 10_000)).toHaveLength(100);
  });
});
