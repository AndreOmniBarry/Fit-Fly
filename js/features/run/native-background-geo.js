// Real background GPS tracking via @capacitor-community/background-
// geolocation — a real foreground service (Android) / background
// location mode (iOS) that keeps delivering position updates with the
// screen locked or the app fully backgrounded, unlike
// navigator.geolocation.watchPosition (which the plain web build still
// uses — see gps-math.js/run-tracker.js — and which every browser
// suspends the moment a tab isn't the active, foregrounded page).
//
// Entirely inert outside a native build: every export here checks
// isNativeRuntime() first, same contract as native-pedometer.js.
import { registerPlugin } from '../../vendor/capacitor-core.mjs';
import { isNativeRuntime } from '../../lib/native-runtime.js';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

export function isNativeBackgroundGeoAvailable() {
  return isNativeRuntime();
}

/**
 * @param {object} callbacks
 * @param {(point: {lat:number, lon:number, accuracyM:number|null, tMs:number}) => void} callbacks.onPosition
 * @param {(error: Error) => void} callbacks.onError
 * @returns {Promise<{stop: () => void}|null>} null if unsupported or
 *   the watcher genuinely failed to start (permission denied, etc. —
 *   surfaced through onError first).
 */
export async function startNativeBackgroundWatch({ onPosition, onError }) {
  if (!isNativeRuntime()) return null;

  try {
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'Tracking your run',
        backgroundMessage: 'Fit Fly is recording your route in the background — tap to open.',
        requestPermissions: true,
        stale: false,
        // Real movement, not GPS jitter noise — matches the spirit of
        // gps-math.js's own filterAccuratePoints threshold rather than
        // reporting every sub-meter wobble.
        distanceFilter: 5,
      },
      (location, error) => {
        if (error) {
          onError?.(
            new Error(
              error.code === 'NOT_AUTHORIZED'
                ? 'Location access is off for this app — check its permission in your phone\'s Settings.'
                : (error.message ?? 'Location signal lost — this can happen indoors or with a weak GPS fix.')
            )
          );
          return;
        }
        if (!location) return;
        onPosition?.({
          lat: location.latitude,
          lon: location.longitude,
          accuracyM: location.accuracy ?? null,
          tMs: location.time,
        });
      }
    );

    return {
      stop: () => {
        void BackgroundGeolocation.removeWatcher({ id: watcherId });
      },
    };
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
