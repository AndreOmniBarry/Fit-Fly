import { describe, expect, it } from 'vitest';
import { assessSignalQuality, SIGNAL_QUALITY } from '../../../js/features/heart-rate/signal-quality.js';

/** Same deterministic sine-wave signal shape as ppg-signal.test.js — no
 *  Math.random(), so these never flake. */
function generateSineSamples({ bpm, durationSec, sampleRateHz = 30, amplitude = 10, baseline = 128 }) {
  const freqHz = bpm / 60;
  const totalSamples = Math.floor(durationSec * sampleRateHz);
  const samples = [];
  for (let i = 0; i < totalSamples; i++) {
    const tSec = i / sampleRateHz;
    samples.push({ tMs: Math.round(tSec * 1000), value: baseline + amplitude * Math.sin(2 * Math.PI * freqHz * tSec) });
  }
  return samples;
}

describe('assessSignalQuality', () => {
  it('reports "settling" with too few samples to judge anything yet', () => {
    const result = assessSignalQuality([{ tMs: 0, value: 128 }]);
    expect(result.level).toBe(SIGNAL_QUALITY.SETTLING);
  });

  it('reports "good" for a clean pulse-like signal, the same amplitude the estimator resolves confidently', () => {
    const samples = generateSineSamples({ bpm: 72, durationSec: 3, amplitude: 10 });
    const result = assessSignalQuality(samples);
    expect(result.level).toBe(SIGNAL_QUALITY.GOOD);
  });

  it('reports "good" for a weaker but still real pulse amplitude', () => {
    const samples = generateSineSamples({ bpm: 72, durationSec: 3, amplitude: 3 });
    const result = assessSignalQuality(samples);
    expect(result.level).toBe(SIGNAL_QUALITY.GOOD);
  });

  it('reports "no-pulse" for a flat signal (sensor uncovered, or truly no beat visible)', () => {
    const samples = generateSineSamples({ bpm: 72, durationSec: 3, amplitude: 0 });
    const result = assessSignalQuality(samples);
    expect(result.level).toBe(SIGNAL_QUALITY.NO_PULSE);
  });

  it('reports "unsteady" for an erratic, high-amplitude signal (motion, not a real pulse)', () => {
    // A pulse doesn't swing anywhere near the full 0-255 brightness
    // range — a signal that does is motion/lighting artifact, not a
    // heartbeat.
    const samples = generateSineSamples({ bpm: 72, durationSec: 3, amplitude: 60 });
    const result = assessSignalQuality(samples);
    expect(result.level).toBe(SIGNAL_QUALITY.UNSTEADY);
  });
});
