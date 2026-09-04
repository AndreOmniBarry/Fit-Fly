import { estimateHeartRateFromSamples } from './ppg-signal.js';
import { assessSignalQuality, SIGNAL_QUALITY } from './signal-quality.js';

const SAMPLE_DURATION_MS = 15000;
// How often to recompute/report live signal quality — every animation
// frame would be needless DOM churn for text that only needs to feel
// live, not literally 60fps.
const QUALITY_UPDATE_MS = 300;
// "Recent" window fed to assessSignalQuality — long enough to judge a
// real pulse's periodicity, short enough to react quickly to a finger
// that's just been repositioned.
const QUALITY_WINDOW_MS = 3000;
// A real reliability fix, not just a UX one: waiting out the full 15s
// once the signal has shown no pulse at all for this long is waiting on
// a reading that's already doomed — nothing found in the next few
// seconds is going to fix a finger that isn't actually covering the
// sensor. Ending the capture here instead saves real time and reuses
// the exact same "couldn't get a clear enough reading" message the
// after-the-fact failure already shows.
const NO_PULSE_ABORT_MS = 5000;

/**
 * Drives a getUserMedia camera stream through a tiny offscreen canvas,
 * averaging the red channel per frame into a brightness sample buffer,
 * then hands that buffer to ppg-signal.js once enough time has passed.
 * A fingertip pressed over the rear camera (ideally with the flash on)
 * makes this brightness value pulse with each heartbeat.
 *
 * @param {object} callbacks
 * @param {(progress: {elapsedMs: number, durationMs: number}) => void} [callbacks.onProgress]
 * @param {(quality: ReturnType<typeof assessSignalQuality>) => void} [callbacks.onQuality] -
 *   live feedback during capture, throttled to QUALITY_UPDATE_MS
 * @param {(active: boolean) => void} [callbacks.onTorchStatus] - fired once,
 *   right after the stream starts, saying whether the flash was actually
 *   turned on (best-effort — most browsers besides Chrome/Android don't
 *   expose torch control at all)
 * @param {(result: ReturnType<typeof estimateHeartRateFromSamples>) => void} callbacks.onComplete
 * @param {(error: Error) => void} [callbacks.onError]
 */
export function createCameraPpgSession({ onProgress, onQuality, onTorchStatus, onComplete, onError }) {
  let stream = null;
  let video = null;
  let canvas = null;
  let ctx = null;
  let samples = [];
  let rafHandle = null;
  let startTMs = null;
  let stopped = false;
  let lastQualityUpdateMs = -Infinity;
  let noPulseStartMs = null; // when the current unbroken no-pulse streak began; null while not in one

  /** Best-effort — torch control is a non-standard MediaTrackConstraint
   *  Chrome/Android exposes and nothing else does. A stronger, more even
   *  light source through the fingertip is a real, meaningful signal-
   *  quality improvement where it's available; everywhere else this is
   *  silently a no-op, same honesty contract as the rest of the app's
   *  feature-detected sensors. */
  async function setTorch(active) {
    const track = stream?.getVideoTracks()[0];
    if (!track?.getCapabilities?.().torch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: active }] });
      return active;
    } catch {
      return false;
    }
  }

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

    const torchActive = await setTorch(true);
    onTorchStatus?.(torchActive);

    video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    // The very first frame(s) after play() can render before the stream
    // has real image data — wait for a frame to actually be available
    // rather than risk seeding the sample buffer with a black frame.
    if (video.readyState < 2) {
      await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
    }

    canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32; // a tiny sample region is plenty for an average brightness reading
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    samples = [];
    stopped = false;
    lastQualityUpdateMs = -Infinity;
    noPulseStartMs = null;
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

    let quality = null;
    if (elapsedMs - lastQualityUpdateMs >= QUALITY_UPDATE_MS) {
      lastQualityUpdateMs = elapsedMs;
      const recent = samples.filter((s) => elapsedMs - s.tMs <= QUALITY_WINDOW_MS);
      quality = assessSignalQuality(recent);
      onQuality?.(quality);
    }

    if (quality?.level === SIGNAL_QUALITY.NO_PULSE) {
      if (noPulseStartMs == null) noPulseStartMs = elapsedMs;
    } else if (quality != null) {
      noPulseStartMs = null; // any real reading (or still-settling) breaks the streak
    }

    if (noPulseStartMs != null && elapsedMs - noPulseStartMs >= NO_PULSE_ABORT_MS) {
      finish(); // estimateHeartRateFromSamples will honestly return null on this thin a signal
    } else if (elapsedMs >= SAMPLE_DURATION_MS) {
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
    void setTorch(false); // best-effort — never leave the flash on after a reading
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
