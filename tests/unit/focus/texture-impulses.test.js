import { describe, expect, it } from 'vitest';
import { createPrng } from '../../../js/features/focus/prng.js';
import { generateImpulseTrain } from '../../../js/features/focus/texture-impulses.js';

const RAIN_OPTIONS = { density: 25, minDurationSeconds: 0.004, maxDurationSeconds: 0.014, minGain: 0.15, maxGain: 0.55, decayRate: 40 };

describe('generateImpulseTrain', () => {
  it('produces sampleRate * lengthSeconds samples', () => {
    const buffer = generateImpulseTrain(48000, 2, RAIN_OPTIONS, createPrng(1));
    expect(buffer).toHaveLength(96000);
  });

  it('stays within [-1, 1]', () => {
    const buffer = generateImpulseTrain(48000, 2, RAIN_OPTIONS, createPrng(1));
    for (const v of buffer) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('never produces NaN or Infinity', () => {
    const buffer = generateImpulseTrain(48000, 2, RAIN_OPTIONS, createPrng(1));
    expect(buffer.some((v) => !Number.isFinite(v))).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    const a = generateImpulseTrain(48000, 2, RAIN_OPTIONS, createPrng(7));
    const b = generateImpulseTrain(48000, 2, RAIN_OPTIONS, createPrng(7));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('is genuinely sparse — mostly silence between real impulses, not a continuous texture', () => {
    const buffer = generateImpulseTrain(48000, 2, RAIN_OPTIONS, createPrng(3));
    const silentSamples = Array.from(buffer).filter((v) => v === 0).length;
    // At ~25 impulses/sec of a few milliseconds each, the overwhelming
    // majority of a 2s buffer is real silence between them.
    expect(silentSamples / buffer.length).toBeGreaterThan(0.5);
  });

  it('a higher density produces more non-silent samples than a lower one, all else equal', () => {
    const sparse = generateImpulseTrain(48000, 2, { ...RAIN_OPTIONS, density: 5 }, createPrng(4));
    const dense = generateImpulseTrain(48000, 2, { ...RAIN_OPTIONS, density: 60 }, createPrng(4));
    const nonSilent = (buf) => Array.from(buf).filter((v) => v !== 0).length;
    expect(nonSilent(dense)).toBeGreaterThan(nonSilent(sparse));
  });

  it('real impulse onsets are irregular, not evenly spaced (a genuine Poisson process)', () => {
    // Detect onsets as samples where the signal rises from silence.
    const buffer = generateImpulseTrain(48000, 4, { ...RAIN_OPTIONS, density: 15 }, createPrng(11));
    const onsets = [];
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i - 1] === 0 && buffer[i] !== 0) onsets.push(i);
    }
    expect(onsets.length).toBeGreaterThan(5);
    const gaps = onsets.slice(1).map((v, i) => v - onsets[i]);
    // A real random process has a real spread of gap sizes — a
    // perfectly even grid would have every gap identical.
    const uniqueGaps = new Set(gaps).size;
    expect(uniqueGaps).toBeGreaterThan(gaps.length * 0.5);
  });

  it('an empty/degenerate length still returns a real, finite buffer', () => {
    const buffer = generateImpulseTrain(48000, 0.001, RAIN_OPTIONS, createPrng(1));
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.some((v) => !Number.isFinite(v))).toBe(false);
  });
});
