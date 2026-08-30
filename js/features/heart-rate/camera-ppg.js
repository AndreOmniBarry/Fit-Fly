import { estimateHeartRateFromSamples } from './ppg-signal.js';

const SAMPLE_DURATION_MS = 15000;

/**
 * Drives a getUserMedia camera stream through a tiny offscreen canvas,
 * averaging the red channel per frame into a brightness sample buffer,
 * then hands that buffer to ppg-signal.js once enough time has passed.
 * A fingertip pressed over the rear camera (ideally with the flash on)
 * makes this brightness value pulse with each heartbeat.
 *
 * @param {object} callbacks
 * @param {(progress: {elapsedMs: number, durationMs: number}) => void} [callbacks.onProgress]
 * @param {(result: ReturnType<typeof estimateHeartRateFromSamples>) => void} callbacks.onComplete
 * @param {(error: Error) => void} [callbacks.onError]
 */
export function createCameraPpgSession({ onProgress, onComplete, onError }) {
  let stream = null;
  let video = null;
  let canvas = null;
  let ctx = null;
  let samples = [];
  let rafHandle = null;
  let startTMs = null;
  let stopped = false;

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error('Camera access isn\'t available in this browser.'));
      return false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      onError?.(err);
      return false;
    }

    video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32; // a tiny sample region is plenty for an average brightness reading
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    samples = [];
    stopped = false;
    startTMs = performance.now();
    tick();
    return true;
  }

  function tick() {
    if (stopped) return;
    const elapsedMs = performance.now() - startTMs;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let redSum = 0;
    for (let i = 0; i < frame.length; i += 4) redSum += frame[i];
    const avgRed = redSum / (frame.length / 4);
    samples.push({ tMs: elapsedMs, value: avgRed });

    onProgress?.({ elapsedMs, durationMs: SAMPLE_DURATION_MS });

    if (elapsedMs >= SAMPLE_DURATION_MS) {
      finish();
    } else {
      rafHandle = requestAnimationFrame(tick);
    }
  }

  function finish() {
    stopCapture();
    onComplete?.(estimateHeartRateFromSamples(samples));
  }

  function stopCapture() {
    stopped = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  /** Stops early without producing a result — used when the person
   *  navigates away mid-reading. */
  function cancel() {
    stopCapture();
  }

  return { start, cancel };
}
