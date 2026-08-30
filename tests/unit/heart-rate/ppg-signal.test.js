import { describe, expect, it } from 'vitest';
import { estimateHeartRateFromSamples } from '../../../js/features/heart-rate/ppg-signal.js';

/** A synthetic PPG-like brightness signal: a sine wave at the target
 *  heart rate's frequency, optionally with slow baseline drift (the kind
 *  a real camera reading picks up from finger pressure/lighting changes)
 *  layered on top. Fully deterministic — no Math.random() — so these
 *  tests never flake. */
function generateSineSamples({ bpm, durationSec, sampleRateHz = 30, amplitude = 10, baseline = 128, driftPerSec = 0 }) {
  const freqHz = bpm / 60;
  const totalSamples = Math.floor(durationSec * sampleRateHz);
  const samples = [];
  for (let i = 0; i < totalSamples; i++) {
    const tSec = i / sampleRateHz;
    const value = baseline + driftPerSec * tSec + amplitude * Math.sin(2 * Math.PI * freqHz * tSec);
    samples.push({ tMs: Math.round(tSec * 1000), value });
  }
  return samples;
}

describe('estimateHeartRateFromSamples: recovers the true rate from a clean signal', () => {
  it.each([60, 75, 90, 120])('a pure %i bpm sine wave is estimated within 2 bpm', (bpm) => {
    const samples = generateSineSamples({ bpm, durationSec: 15 });
    const result = estimateHeartRateFromSamples(samples);
    expect(result).not.toBeNull();
    expect(Math.abs(result.bpm - bpm)).toBeLessThanOrEqual(2);
  });

  it('a clean, regular signal earns high confidence with plenty of peaks', () => {
    const samples = generateSineSamples({ bpm: 72, durationSec: 15 });
    const result = estimateHeartRateFromSamples(samples);
    expect(result.confidence).toBe('high');
    expect(result.peakCount).toBeGreaterThanOrEqual(8);
  });
});

describe('estimateHeartRateFromSamples: robust to realistic signal problems', () => {
  it('recovers the rate even with slow baseline drift (finger pressure/lighting changes)', () => {
    const samples = generateSineSamples({ bpm: 80, durationSec: 15, driftPerSec: 4 });
    const result = estimateHeartRateFromSamples(samples);
    expect(result).not.toBeNull();
    expect(Math.abs(result.bpm - 80)).toBeLessThanOrEqual(3);
  });

  it('a lower-amplitude (weaker) pulse signal still resolves, just maybe less confidently', () => {
    const samples = generateSineSamples({ bpm: 68, durationSec: 15, amplitude: 2 });
    const result = estimateHeartRateFromSamples(samples);
    expect(result).not.toBeNull();
    expect(Math.abs(result.bpm - 68)).toBeLessThanOrEqual(3);
  });
});

describe('estimateHeartRateFromSamples: refuses to guess without a real basis', () => {
  it('returns null for too few samples', () => {
    const samples = generateSineSamples({ bpm: 75, durationSec: 0.5 });
    expect(estimateHeartRateFromSamples(samples)).toBeNull();
  });

  it('returns null for a flat signal (no finger on the sensor, or no pulse detectable)', () => {
    const samples = generateSineSamples({ bpm: 75, durationSec: 15, amplitude: 0 });
    expect(estimateHeartRateFromSamples(samples)).toBeNull();
  });

  it('returns null (never a fabricated number) for an empty buffer', () => {
    expect(estimateHeartRateFromSamples([])).toBeNull();
  });

  it('rejects a result outside physiologically plausible range', () => {
    // 20 bpm is well below the plausible floor — even though the peaks
    // are perfectly detectable, the result must be discarded, not shown.
    const samples = generateSineSamples({ bpm: 20, durationSec: 15 });
    expect(estimateHeartRateFromSamples(samples)).toBeNull();
  });

  it('handles zero elapsed time across the buffer without dividing by zero', () => {
    const samples = Array.from({ length: 40 }, () => ({ tMs: 1000, value: 128 }));
    expect(estimateHeartRateFromSamples(samples)).toBeNull();
  });
});
