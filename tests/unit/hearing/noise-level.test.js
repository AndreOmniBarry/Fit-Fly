import { describe, expect, it } from 'vitest';
import {
  computeRms,
  rmsToDbfs,
  dbfsToEstimatedDb,
  classifyNoiseLevel,
  estimateSoundLevelFromSamples,
  estimateEquivalentSoundLevel,
} from '../../../js/features/hearing/noise-level.js';

/** A deterministic sine wave at a given peak amplitude — no Math.random(),
 *  so these tests never flake. A sine's RMS is amplitude / sqrt(2), a
 *  well-known identity used below to check computeRms against a known
 *  answer rather than just re-implementing the same formula. */
function generateSineSamples({ amplitude, count = 512, cyclesOverBuffer = 8 }) {
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * cyclesOverBuffer * i) / count);
  }
  return samples;
}

describe('computeRms', () => {
  it('is 0 for pure silence', () => {
    expect(computeRms(new Float32Array(256))).toBe(0);
  });

  it('is 0 for an empty buffer', () => {
    expect(computeRms(new Float32Array(0))).toBe(0);
  });

  it('is exactly the constant value for a DC (flat, non-oscillating) buffer', () => {
    expect(computeRms(new Float32Array(100).fill(0.5))).toBeCloseTo(0.5, 10);
  });

  it('recovers amplitude/sqrt(2) for a clean sine wave, the standard identity', () => {
    const samples = generateSineSamples({ amplitude: 0.8 });
    expect(computeRms(samples)).toBeCloseTo(0.8 / Math.SQRT2, 2);
  });
});

describe('rmsToDbfs', () => {
  it('full-scale RMS (1.0) is 0 dBFS', () => {
    expect(rmsToDbfs(1)).toBeCloseTo(0, 10);
  });

  it('an RMS of 0.1 is exactly -20 dBFS (20*log10(0.1))', () => {
    expect(rmsToDbfs(0.1)).toBeCloseTo(-20, 10);
  });

  it('silence (rms 0) floors out rather than returning -Infinity', () => {
    const dbfs = rmsToDbfs(0);
    expect(Number.isFinite(dbfs)).toBe(true);
    expect(dbfs).toBeLessThan(-50);
  });
});

describe('dbfsToEstimatedDb', () => {
  it('applies the documented calibration offset (-42 dBFS -> ~94 dB, the reference point cited in code)', () => {
    expect(dbfsToEstimatedDb(-42)).toBe(94);
  });

  it('0 dBFS (full digital scale) maps to a very high estimated dB', () => {
    expect(dbfsToEstimatedDb(0)).toBe(136);
  });
});

describe('classifyNoiseLevel', () => {
  it.each([
    [59, 'quiet'],
    [60, 'moderate'],
    [69, 'moderate'],
    [70, 'loud'],
    [79, 'loud'],
    [80, 'very-loud'],
    [84, 'very-loud'],
    [85, 'harmful'],
    [99, 'harmful'],
    [100, 'dangerous'],
    [150, 'dangerous'],
  ])('classifies %i dB as %s', (db, expectedCategory) => {
    expect(classifyNoiseLevel(db).category).toBe(expectedCategory);
  });

  it('every category carries a real, non-empty label and message, not a placeholder', () => {
    for (const db of [30, 65, 75, 82, 90, 110]) {
      const result = classifyNoiseLevel(db);
      expect(result.label.length).toBeGreaterThan(0);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

describe('estimateSoundLevelFromSamples', () => {
  it('pure silence estimates as Quiet, never a fabricated moderate/loud reading', () => {
    const result = estimateSoundLevelFromSamples(new Float32Array(512));
    expect(result.category).toBe('quiet');
  });

  it('a full-scale sine wave estimates as loud or worse', () => {
    const result = estimateSoundLevelFromSamples(generateSineSamples({ amplitude: 0.95 }));
    expect(['loud', 'very-loud', 'harmful', 'dangerous']).toContain(result.category);
  });
});

describe('estimateEquivalentSoundLevel', () => {
  it('is null with no readings at all — never a fabricated 0 dB result', () => {
    expect(estimateEquivalentSoundLevel([])).toBeNull();
  });

  it('a single reading matches computing that reading directly', () => {
    const rms = 0.3;
    const result = estimateEquivalentSoundLevel([rms]);
    expect(result.estimatedDb).toBe(dbfsToEstimatedDb(rmsToDbfs(rms)));
  });

  it('averages in the power domain, not the dB domain — a brief loud reading dominates the result the way real acoustic Leq does, not the way naively averaging dB numbers would', () => {
    const quietRms = 0.01;
    const loudRms = 1.0;
    // A naive average of the two dB values would land roughly halfway
    // between them; the real power-domain (Leq) average is dominated by
    // the much higher-energy loud reading and lands far closer to it.
    const quietDb = dbfsToEstimatedDb(rmsToDbfs(quietRms));
    const loudDb = dbfsToEstimatedDb(rmsToDbfs(loudRms));
    const naiveAverage = (quietDb + loudDb) / 2;

    const result = estimateEquivalentSoundLevel([quietRms, loudRms]);

    expect(result.estimatedDb).toBeGreaterThan(naiveAverage);
    expect(Math.abs(result.estimatedDb - loudDb)).toBeLessThan(Math.abs(result.estimatedDb - quietDb));
  });
});
