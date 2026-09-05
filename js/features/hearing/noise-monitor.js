// A longer-running "Monitor" session — real periodic ambient-noise
// readings for as long as the screen stays open, the data source behind
// real dose/spike/exposure analysis (see noise-dose.js). Same
// getUserMedia -> AnalyserNode pipeline, and same AGC/noise-suppression/
// echo-cancellation-disabled setup, as noise-capture.js's own one-shot
// 5-second check-in — this is the same real signal, sampled continuously
// over a longer real span instead of once.
//
// Each reported sample is a real equivalent level (Leq) integrated over
// its whole interval — every animation frame between ticks feeds a
// fresh RMS reading into estimateEquivalentSoundLevel (the same
// power-domain averaging the check-in's own 5s Leq already uses), not a
// single instantaneous snapshot taken right when the interval ends. A
// snapshot-only approach would genuinely miss a spike that happens
// between ticks; continuous integration is what an actual dosimeter
// does, and it's what makes this session's own dose/spike math honest.
//
// Still entirely foreground-only: a browser tab has no way to keep a
// microphone stream open once it's backgrounded or the screen locks —
// the same "no passive background pedometer on the web" limit
// motion-steps.js documents, for exactly the same platform reason. Once
// wrapped natively via Capacitor (js/lib/native-runtime.js), a real
// foreground-service-backed background mic session becomes possible —
// the same seam Steps' native pedometer and Run's native GPS already use.

import { computeRms, estimateEquivalentSoundLevel } from './noise-level.js';

/**
 * @param {object} options
 * @param {number} options.intervalMs - real elapsed time each reported
 *   sample's Leq is integrated over.
 * @param {(sample: {estimatedDb:number, category:string, label:string, message:string, recordedAt:string}) => void} options.onSample
 * @param {(error: Error) => void} [options.onError]
 */
export function createNoiseMonitorSession({ intervalMs, onSample, onError }) {
  let stream = null;
  let ctx = null;
  let analyser = null;
  let buffer = null;
  let rafHandle = null;
  let intervalStartMs = 0;
  let rmsReadings = [];
  let running = false;

  function getAudioContextClass() {
    return window.AudioContext ?? window.webkitAudioContext ?? null;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error("Microphone access isn't available in this browser."));
      return false;
    }
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) {
      onError?.(new Error("Audio processing isn't available in this browser."));
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
      });
    } catch (err) {
      onError?.(err);
      return false;
    }

    ctx = new AudioContextClass();
    const source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    buffer = new Float32Array(analyser.fftSize);

    running = true;
    rmsReadings = [];
    intervalStartMs = performance.now();
    tick();
    return true;
  }

  function tick() {
    if (!running) return;

    analyser.getFloatTimeDomainData(buffer);
    rmsReadings.push(computeRms(buffer));

    if (performance.now() - intervalStartMs >= intervalMs) {
      const level = estimateEquivalentSoundLevel(rmsReadings);
      if (level) onSample({ ...level, recordedAt: new Date().toISOString() });
      rmsReadings = [];
      intervalStartMs = performance.now();
    }

    rafHandle = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    void ctx?.close();
    ctx = null;
  }

  return {
    start,
    stop,
    get running() {
      return running;
    },
  };
}
