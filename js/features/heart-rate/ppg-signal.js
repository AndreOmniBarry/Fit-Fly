// Camera-PPG (photoplethysmography) heart rate estimation from a buffer
// of brightness samples — a fingertip over the rear camera+flash makes
// the sensor's red-channel reading rise and fall with each pulse of
// blood. This is signal processing on a noisy, indirect signal, not a
// medical-grade sensor reading: every result here is meant to be shown
// as an ESTIMATE with a confidence, never presented as a fact. See
// js/features/heart-rate/camera-ppg.js for the getUserMedia/canvas
// sampling loop that produces the sample buffer this consumes.

const MIN_SAMPLES = 30;
const MIN_PEAKS_FOR_ESTIMATE = 5;
const MIN_BPM = 40;
const MAX_BPM = 200;

function movingAverage(values, windowSize) {
  const half = Math.floor(windowSize / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    return sum / (hi - lo + 1);
  });
}

/** Subtracts a wide moving average to remove slow baseline drift
 *  (finger pressure/lighting changes), isolating the fast pulsatile
 *  (AC) component the heartbeat actually shows up in. */
function detrend(samples, sampleRateHz) {
  const windowSize = Math.max(3, Math.round(sampleRateHz * 1.5));
  const values = samples.map((s) => s.value);
  const baseline = movingAverage(values, windowSize);
  return samples.map((s, i) => ({ tMs: s.tMs, value: values[i] - baseline[i] }));
}

function smooth(samples, windowSize) {
  const values = samples.map((s) => s.value);
  const smoothed = movingAverage(values, windowSize);
  return samples.map((s, i) => ({ tMs: s.tMs, value: smoothed[i] }));
}

/** Local maxima above mean + 0.5 stddev, at least minIntervalMs apart —
 *  the interval floor is a physiological refractory period (nothing
 *  beats faster than MAX_BPM) that stops noise from being counted as
 *  multiple beats. */
function detectPeaks(samples, minIntervalMs) {
  const values = samples.map((s) => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const threshold = mean + Math.sqrt(variance) * 0.5;

  const peaks = [];
  let lastPeakTMs = -Infinity;
  for (let i = 1; i < samples.length - 1; i++) {
    const isLocalMax = values[i] > values[i - 1] && values[i] >= values[i + 1];
    if (isLocalMax && values[i] > threshold && samples[i].tMs - lastPeakTMs >= minIntervalMs) {
      peaks.push(samples[i]);
      lastPeakTMs = samples[i].tMs;
    }
  }
  return peaks;
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param {{tMs: number, value: number}[]} samples - roughly evenly-spaced
 *   brightness samples, tMs relative or absolute (only differences matter)
 * @returns {{bpm: number, confidence: 'low'|'medium'|'high', peakCount: number}|null}
 *   null means the signal wasn't clean/long enough to estimate anything —
 *   the caller should ask the person to hold still and try again, not
 *   show a number with no basis.
 */
export function estimateHeartRateFromSamples(samples) {
  if (samples.length < MIN_SAMPLES) return null;

  const durationMs = samples[samples.length - 1].tMs - samples[0].tMs;
  if (!(durationMs > 0)) return null;
  const sampleRateHz = samples.length / (durationMs / 1000);

  const detrended = detrend(samples, sampleRateHz);
  const smoothed = smooth(detrended, Math.max(3, Math.round(sampleRateHz * 0.1)));

  const minIntervalMs = 60000 / MAX_BPM;
  const peaks = detectPeaks(smoothed, minIntervalMs);
  if (peaks.length < MIN_PEAKS_FOR_ESTIMATE) return null;

  const interBeatIntervalsMs = [];
  for (let i = 1; i < peaks.length; i++) {
    interBeatIntervalsMs.push(peaks[i].tMs - peaks[i - 1].tMs);
  }

  const medianIbiMs = median(interBeatIntervalsMs);
  const bpm = 60000 / medianIbiMs;
  if (bpm < MIN_BPM || bpm > MAX_BPM) return null;

  // Confidence: how consistent the beat-to-beat spacing is. A real pulse
  // is fairly regular; a noisy/motion-corrupted signal is erratic.
  const meanIbi = interBeatIntervalsMs.reduce((a, b) => a + b, 0) / interBeatIntervalsMs.length;
  const ibiStdDev = Math.sqrt(
    interBeatIntervalsMs.reduce((a, b) => a + (b - meanIbi) ** 2, 0) / interBeatIntervalsMs.length
  );
  const coefficientOfVariation = ibiStdDev / meanIbi;

  let confidence;
  if (coefficientOfVariation < 0.08 && peaks.length >= 8) confidence = 'high';
  else if (coefficientOfVariation < 0.18) confidence = 'medium';
  else confidence = 'low';

  return { bpm: Math.round(bpm), confidence, peakCount: peaks.length };
}
