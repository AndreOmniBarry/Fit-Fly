// Live signal-quality feedback for a camera-PPG capture in progress —
// the biggest real gap in the original build: 15 seconds of silence,
// then a pass/fail with no way to self-correct mid-reading. This gives
// a person something to react to *while it's still happening* (press
// harder, hold still, recheck finger placement) instead of only finding
// out it failed after the fact.
//
// Deliberately a coarse, honest heuristic — coefficient of variation
// (stddev / mean) of the raw brightness samples over a short recent
// window — not a claim of diagnosing exactly what's wrong. Calibrated
// against the same signal shapes ppg-signal.test.js's estimator tests
// use (a clean pulse's CV is roughly 0.02–0.08 at realistic amplitudes;
// a flat/uncovered sensor sits near 0).

const MIN_SAMPLES_FOR_QUALITY = 8;
const NO_PULSE_CV_THRESHOLD = 0.004;
const UNSTEADY_CV_THRESHOLD = 0.18;

export const SIGNAL_QUALITY = Object.freeze({
  SETTLING: 'settling',
  NO_PULSE: 'no-pulse',
  GOOD: 'good',
  UNSTEADY: 'unsteady',
});

/** @param {{tMs:number, value:number}[]} recentSamples - already windowed
 *   to "the last few seconds" by the caller (camera-ppg.js)
 *  @returns {{level: string, message: string}} */
export function assessSignalQuality(recentSamples) {
  if (recentSamples.length < MIN_SAMPLES_FOR_QUALITY) {
    return { level: SIGNAL_QUALITY.SETTLING, message: 'Getting a baseline reading…' };
  }

  const values = recentSamples.map((s) => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  if (coefficientOfVariation < NO_PULSE_CV_THRESHOLD) {
    return {
      level: SIGNAL_QUALITY.NO_PULSE,
      message: 'No pulse detected yet — press your fingertip fully over the camera and flash.',
    };
  }
  if (coefficientOfVariation > UNSTEADY_CV_THRESHOLD) {
    return { level: SIGNAL_QUALITY.UNSTEADY, message: 'Signal is noisy — hold your finger still.' };
  }
  return { level: SIGNAL_QUALITY.GOOD, message: 'Signal looks good — hold steady.' };
}
