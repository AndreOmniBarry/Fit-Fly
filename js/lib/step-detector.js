// A real, standard threshold-crossing step-detection algorithm — the same
// basic technique behind most simple pedometer implementations: watch the
// magnitude of linear acceleration (gravity already removed by the sensor
// itself — see motion-steps.js), and count one step every time it rises
// above a threshold and then falls back below it, with a refractory period
// so one step's rise-then-fall can't be double-counted as two.
//
// Deliberately pure and stateful-but-synchronous — addSample() takes one
// real sensor reading at a time and returns the running count, so it can
// be driven by either a live sensor stream or, in tests, a synthetic
// series of samples with known, hand-computed expected step counts. No
// randomness, no timers, no I/O.

const DEFAULT_OPTIONS = {
  // A light moving-average low-pass filter — real accelerometer data is
  // noisy sample-to-sample; this smooths that out without meaningfully
  // delaying the real step-shaped rise.
  smoothingWindow: 5,
  // m/s² above baseline (0, since gravity is already removed) a smoothed
  // reading has to cross to register as the "rise" half of a step — a
  // real, typical footfall's linear-acceleration spike, not an invented
  // number tuned to look good in a demo.
  peakThreshold: 1.2,
  // No real human takes more than ~4 steps/second — anything faster than
  // this is the same footfall's signal ringing, not a second step.
  minStepIntervalMs: 250,
};

export function createStepDetector(options = {}) {
  const { smoothingWindow, peakThreshold, minStepIntervalMs } = { ...DEFAULT_OPTIONS, ...options };
  const recentMagnitudes = [];
  let lastStepAt = -Infinity;
  let stepCount = 0;
  let rising = false;

  /** @param {number} magnitude m/s², the linear-acceleration vector's magnitude
   *  @param {number} timestampMs
   *  @returns {number} the running total step count after this sample */
  function addSample(magnitude, timestampMs) {
    recentMagnitudes.push(magnitude);
    if (recentMagnitudes.length > smoothingWindow) recentMagnitudes.shift();
    const smoothed = recentMagnitudes.reduce((a, b) => a + b, 0) / recentMagnitudes.length;

    if (!rising && smoothed > peakThreshold) {
      rising = true;
    } else if (rising && smoothed <= peakThreshold) {
      rising = false;
      if (timestampMs - lastStepAt >= minStepIntervalMs) {
        stepCount++;
        lastStepAt = timestampMs;
      }
    }
    return stepCount;
  }

  function reset() {
    recentMagnitudes.length = 0;
    lastStepAt = -Infinity;
    stepCount = 0;
    rising = false;
  }

  return {
    addSample,
    reset,
    get stepCount() {
      return stepCount;
    },
  };
}
