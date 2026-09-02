// Real step counting via the Generic Sensor API's LinearAccelerationSensor
// — gravity already removed by the sensor itself, unlike the raw
// Accelerometer, which is what makes a fixed threshold in step-
// detector.js's peak detector meaningful. Feature-detected: this is a
// Chrome/Android(+desktop-with-a-real-sensor) API with no Safari/iOS
// implementation at all, the same platform gap as Web Bluetooth — so this
// always has to degrade gracefully, never assume it's there.
import { createStepDetector } from '../../lib/step-detector.js';

export function isMotionSensingAvailable() {
  return typeof window !== 'undefined' && 'LinearAccelerationSensor' in window;
}

/**
 * @param {object} callbacks
 * @param {(stepCount: number) => void} callbacks.onStepCount fires on every new step
 * @param {(error: Error) => void} callbacks.onError
 * @returns {{stop: () => void}|null} null if unsupported or permission/construction failed
 */
export function startStepCounting({ onStepCount, onError }) {
  if (!isMotionSensingAvailable()) {
    onError?.(new Error("This browser doesn't support motion sensing — log today's steps manually instead."));
    return null;
  }

  try {
    const detector = createStepDetector();
    // 30Hz is plenty of resolution for footfall-scale motion (a step
    // takes several hundred ms) without draining battery pointlessly
    // fast — real pedometer implementations sample in this range.
    const sensor = new window.LinearAccelerationSensor({ frequency: 30 });

    sensor.addEventListener('reading', () => {
      const magnitude = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
      const count = detector.addSample(magnitude, performance.now());
      onStepCount?.(count);
    });
    sensor.addEventListener('error', (event) => {
      // SecurityError: blocked by permissions policy. NotAllowedError:
      // the user denied the permission prompt. NotReadableError: no real
      // sensor to read from (common on desktop/emulators).
      const name = event.error?.name;
      const message =
        name === 'NotAllowedError'
          ? 'Motion-sensor access was denied — allow it in your browser settings to count steps live.'
          : "Couldn't access a motion sensor on this device — log today's steps manually instead.";
      onError?.(new Error(message));
    });

    sensor.start();
    return { stop: () => sensor.stop() };
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
