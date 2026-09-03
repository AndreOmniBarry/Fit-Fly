// Real background step counting via a custom native Capacitor plugin —
// android/app/src/main/java/app/fitfly/mobile/stepcounter/. No off-the-
// shelf Capacitor pedometer plugin actually keeps sensing across a
// locked screen on Android (the ones evaluated for this app unregister
// their sensor listener the moment the host Activity pauses); this
// project's own plugin instead runs a real foreground service with a
// persistent notification — the same architecture
// @capacitor-community/background-geolocation already uses for Run's
// GPS tracking, applied to the step-counter sensor instead. See
// StepCounterService.java's own header comment for the full mechanism.
//
// Entirely inert outside a native build: every export here checks
// isNativeRuntime() first and no-ops (or resolves an honest empty
// result) rather than ever throwing into a plain browser tab — provably
// false everywhere this app runs today, same contract as every other
// feature-detected API in this codebase.
import { registerPlugin } from '../../vendor/capacitor-core.mjs';
import { isNativeRuntime } from '../../lib/native-runtime.js';

const FitFlyStepCounter = registerPlugin('FitFlyStepCounter');

export function isNativeStepCounterAvailable() {
  return isNativeRuntime();
}

/** @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>} */
export async function getNativeStepPermission() {
  if (!isNativeRuntime()) return 'unsupported';
  const { activityRecognition } = await FitFlyStepCounter.checkPermissions();
  return activityRecognition;
}

/** @returns {Promise<'granted'|'denied'|'prompt'|'unsupported'>} */
export async function requestNativeStepPermission() {
  if (!isNativeRuntime()) return 'unsupported';
  const { activityRecognition } = await FitFlyStepCounter.requestPermissions();
  return activityRecognition;
}

/** Starts the real foreground service — steps keep counting from this
 *  point on even once the screen locks or the app is fully closed, for
 *  as long as Android lets the service keep running (see
 *  StepCounterService's own START_STICKY comment for the honest limit:
 *  best-effort, not an unkillable guarantee). */
export async function startNativeBackgroundStepCounting() {
  if (!isNativeRuntime()) return;
  await FitFlyStepCounter.startBackgroundCounting();
}

export async function stopNativeBackgroundStepCounting() {
  if (!isNativeRuntime()) return;
  await FitFlyStepCounter.stopBackgroundCounting();
}

/** Today's real total from the background-persisted hardware counter —
 *  reflects every step since local midnight, including ones taken while
 *  the app wasn't open at all, as long as the background service was
 *  running. `hasReading: false` (steps always 0) means exactly that: no
 *  real reading exists yet today, never a guess standing in for one.
 *  @returns {Promise<{steps: number, hasReading: boolean}>} */
export async function getNativeTodayStepCount() {
  if (!isNativeRuntime()) return { steps: 0, hasReading: false };
  return FitFlyStepCounter.getTodayStepCount();
}

/** Live "steps so far today" updates while this listener is active —
 *  on top of, never instead of, the real background persistence above.
 *  Only actually observable while the app is foregrounded (JS itself
 *  doesn't run otherwise), which is fine: the underlying count keeps
 *  accumulating in the background regardless of whether anything is
 *  listening to hear about it as it happens.
 *  @returns {() => void} unsubscribe */
export function onNativeStepCountChanged(callback) {
  if (!isNativeRuntime()) return () => {};
  const handlePromise = FitFlyStepCounter.addListener('stepCountChanged', (event) => {
    callback(event.steps);
  });
  handlePromise.catch(() => {});
  return () => {
    handlePromise.then((handle) => handle.remove()).catch(() => {});
  };
}
