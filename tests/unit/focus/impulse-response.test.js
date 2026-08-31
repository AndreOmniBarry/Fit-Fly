import { describe, expect, it } from 'vitest';
import { createPrng } from '../../../js/features/focus/prng.js';
import { generateImpulseResponse } from '../../../js/features/focus/impulse-response.js';

describe('generateImpulseResponse', () => {
  it('produces duration * sampleRate samples', () => {
    const ir = generateImpulseResponse(1.5, 48000, 2.5, createPrng(1));
    expect(ir).toHaveLength(72000);
  });

  it('stays within [-1, 1]', () => {
    const ir = generateImpulseResponse(0.5, 48000, 2.5, createPrng(1));
    for (const v of ir) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('decays — the back half carries much less energy than the front half', () => {
    const ir = generateImpulseResponse(1, 48000, 2.5, createPrng(1));
    const half = Math.floor(ir.length / 2);
    const rms = (buf) => Math.sqrt(Array.from(buf).reduce((sum, v) => sum + v * v, 0) / buf.length);

    expect(rms(ir.slice(half))).toBeLessThan(rms(ir.slice(0, half)));
  });

  it('a higher decay value decays faster (less tail energy)', () => {
    const gentle = generateImpulseResponse(1, 48000, 1, createPrng(1));
    const steep = generateImpulseResponse(1, 48000, 6, createPrng(1));
    const tailRms = (buf) => {
      const tail = buf.slice(Math.floor(buf.length * 0.75));
      return Math.sqrt(Array.from(tail).reduce((sum, v) => sum + v * v, 0) / tail.length);
    };
    expect(tailRms(steep)).toBeLessThan(tailRms(gentle));
  });

  it('is deterministic for the same seed', () => {
    const a = generateImpulseResponse(0.2, 48000, 2.5, createPrng(5));
    const b = generateImpulseResponse(0.2, 48000, 2.5, createPrng(5));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('never produces NaN or Infinity', () => {
    const ir = generateImpulseResponse(0.3, 48000, 2.5, createPrng(1));
    expect(ir.some((v) => !Number.isFinite(v))).toBe(false);
  });
});
