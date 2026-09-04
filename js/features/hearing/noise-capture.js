import { computeRms, estimateEquivalentSoundLevel, estimateSoundLevelFromSamples } from './noise-level.js';

const CAPTURE_DURATION_MS = 5000;
// How often to recompute/report the live readout — every animation
// frame would be needless DOM churn for a number that only needs to
// feel live, same reasoning as camera-ppg.js's QUALITY_UPDATE_MS.
const LIVE_UPDATE_MS = 200;

/**
 * Drives a getUserMedia microphone stream through a Web Audio
 * AnalyserNode, polling real time-domain samples for the whole capture
 * window and handing them to noise-level.js for both a live in-progress
 * readout and a final Leq (equivalent continuous level) result.
 *
 * Explicitly disables the browser's own automatic gain control, noise
 * suppression, and echo cancellation — all three exist to normalize
 * *voice* audio for calls, and left on would silently renormalize
 * whatever level is actually present, making a level reading meaningless.
 *
 * @param {object} callbacks
 * @param {(progress: {elapsedMs: number, durationMs: number}) => void} [callbacks.onProgress]
 * @param {(level: ReturnType<typeof estimateSoundLevelFromSamples>) => void} [callbacks.onLiveLevel]
 * @param {(result: ReturnType<typeof estimateEquivalentSoundLevel>) => void} callbacks.onComplete
 * @param {(error: Error) => void} [callbacks.onError]
 */
export function createNoiseCaptureSession({ onProgress, onLiveLevel, onComplete, onError }) {
  let stream = null;
  let ctx = null;
  let analyser = null;
  let source = null;
  let buffer = null;
  let rafHandle = null;
  let startTMs = null;
  let stopped = false;
  let rmsReadings = [];
  let lastUpdateMs = -Infinity;

  function getAudioContextClass() {
    return window.AudioContext ?? window.webkitAudioContext ?? null;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error('Microphone access isn\'t available in this browser.'));
      return false;
    }
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) {
      onError?.(new Error('Audio processing isn\'t available in this browser.'));
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
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    buffer = new Float32Array(analyser.fftSize);

    rmsReadings = [];
    stopped = false;
    lastUpdateMs = -Infinity;
    startTMs = performance.now();
    tick();
    return true;
  }

  function tick() {
    if (stopped) return;
    const elapsedMs = performance.now() - startTMs;

    analyser.getFloatTimeDomainData(buffer);
    rmsReadings.push(computeRms(buffer));

    onProgress?.({ elapsedMs, durationMs: CAPTURE_DURATION_MS });

    if (elapsedMs - lastUpdateMs >= LIVE_UPDATE_MS) {
      lastUpdateMs = elapsedMs;
      onLiveLevel?.(estimateSoundLevelFromSamples(buffer));
    }

    if (elapsedMs >= CAPTURE_DURATION_MS) {
      finish();
    } else {
      rafHandle = requestAnimationFrame(tick);
    }
  }

  function finish() {
    stopCapture();
    onComplete?.(estimateEquivalentSoundLevel(rmsReadings));
  }

  function stopCapture() {
    stopped = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    void ctx?.close();
    ctx = null;
  }

  /** Stops early without producing a result — used when the person
   *  navigates away mid-reading. */
  function cancel() {
    stopCapture();
  }

  return { start, cancel };
}
