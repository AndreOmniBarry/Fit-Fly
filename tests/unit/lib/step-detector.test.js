import { describe, expect, it } from 'vitest';
import { createStepDetector } from '../../../js/lib/step-detector.js';

/** Feeds a synthetic, realistically-dense sequence of "footfall" cycles —
 *  a smooth rise-to-peak-then-fall in magnitude each cadence period,
 *  sampled at a rate comparable to the real sensor's 30Hz (~15 samples
 *  across a 500ms step) — and returns the final step count. Mirrors the
 *  synthetic-signal testing style already used for the camera-PPG
 *  heart-rate estimator: deterministic, no real sensor required. */
function simulateSteps(detector, { stepCount, cadenceMs, peakMagnitude = 2.5, samplesPerStep = 15, startAt = 0 }) {
  let count = 0;
  for (let i = 0; i < stepCount; i++) {
    for (let s = 0; s < samplesPerStep; s++) {
      const phase = s / samplesPerStep; // 0..1 across this step's rise-and-fall
      const t = startAt + i * cadenceMs + phase * cadenceMs;
      const magnitude = Math.max(0.05, peakMagnitude * Math.sin(Math.PI * phase));
      count = detector.addSample(magnitude, t);
    }
  }
  // One final at-rest sample so the very last step's fall-below-threshold
  // transition actually completes within the simulated window, rather
  // than the walk simply ending mid-fall — a real walk ends the same
  // way, settling back to near-zero once someone stops moving.
  count = detector.addSample(0.05, startAt + stepCount * cadenceMs);
  return count;
}

describe('createStepDetector', () => {
  it('starts at zero steps', () => {
    const detector = createStepDetector();
    expect(detector.stepCount).toBe(0);
  });

  it('counts one step per real rise-then-fall above the threshold', () => {
    const detector = createStepDetector();
    const count = simulateSteps(detector, { stepCount: 10, cadenceMs: 500 });
    expect(count).toBe(10);
    expect(detector.stepCount).toBe(10);
  });

  it('never counts a step from magnitude that stays under the threshold — standing still', () => {
    const detector = createStepDetector();
    for (let t = 0; t < 5000; t += 33) {
      detector.addSample(0.05 + Math.random() * 0.1, t); // small sensor noise, never a real spike
    }
    expect(detector.stepCount).toBe(0);
  });

  it("does not double-count a single footfall's spike ringing within the refractory period", () => {
    const detector = createStepDetector({ minStepIntervalMs: 250 });
    // One real step's rise-peak-fall...
    detector.addSample(0.1, 0);
    detector.addSample(1.8, 30);
    detector.addSample(2.2, 60);
    detector.addSample(1.8, 90);
    detector.addSample(0.1, 120);
    // ...immediately followed by noisy ringing that crosses the
    // threshold again well inside the refractory window — must not
    // count as a second step.
    detector.addSample(1.5, 140);
    detector.addSample(1.6, 160);
    detector.addSample(0.1, 180);
    expect(detector.stepCount).toBe(1);
  });

  it('does count a genuinely new step after the refractory period has passed', () => {
    const detector = createStepDetector({ minStepIntervalMs: 250 });
    simulateSteps(detector, { stepCount: 1, cadenceMs: 500 });
    expect(detector.stepCount).toBe(1);

    // A genuine lull — walking paused — flushes the smoothing window
    // back to baseline, well past the refractory window too.
    for (let t = 600; t < 1200; t += 33) detector.addSample(0.05, t);

    const finalCount = simulateSteps(detector, { stepCount: 1, cadenceMs: 500, startAt: 1200 });
    expect(finalCount).toBe(2);
  });

  it('smooths out a single noisy sample spike that never sustains long enough to be a real step', () => {
    // A brief one-sample glitch amid otherwise-flat readings gets
    // averaged down by the moving window rather than treated as a step.
    // Warmed up with a few resting samples first, so the window is
    // genuinely full (an ongoing session, not the detector's very first
    // couple of readings, when any partial window is thinner).
    const detector = createStepDetector({ smoothingWindow: 5 });
    for (let t = 0; t < 200; t += 33) detector.addSample(0.1, t);
    detector.addSample(5.0, 233); // one glitchy sample
    detector.addSample(0.1, 266);
    detector.addSample(0.1, 300);
    expect(detector.stepCount).toBe(0);
  });

  it('reset() clears the running count and internal state', () => {
    const detector = createStepDetector();
    simulateSteps(detector, { stepCount: 5, cadenceMs: 500 });
    expect(detector.stepCount).toBe(5);
    detector.reset();
    expect(detector.stepCount).toBe(0);
    // and counts cleanly again afterward
    const count = simulateSteps(detector, { stepCount: 3, cadenceMs: 500, startAt: 10_000 });
    expect(count).toBe(3);
  });
});
