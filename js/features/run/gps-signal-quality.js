// Live GPS-quality feedback for a run in progress — the same "give a
// person something to react to during live capture" fix as heart rate's
// own signal-quality.js, just for a GPS fix's real accuracy radius
// instead of a camera-PPG signal's coefficient of variation.
// filterAccuratePoints (gps-math.js) already silently drops any fix
// worse than 30m before it can inflate distance — this surfaces that
// same real number instead of only ever showing its after-the-fact
// effect, so someone stuck at "weak" understands why their distance
// isn't climbing instead of assuming the app itself is broken.

export const GPS_SIGNAL_QUALITY = Object.freeze({
  ACQUIRING: 'acquiring',
  STRONG: 'strong',
  FAIR: 'fair',
  WEAK: 'weak',
});

const STRONG_MAX_ACCURACY_M = 10;
// Matches filterAccuratePoints' own default cutoff — "fair" is exactly
// the boundary of what still counts toward the route at all.
const FAIR_MAX_ACCURACY_M = 30;

// A GPS chip typically can't get a fix at all through a roof — "Finding
// your location…" sitting unchanged past this long is the one real
// signal that the fix is never coming, not that the app is broken. Past
// it, say so plainly instead of leaving the same neutral message up
// forever regardless of how long someone's been staring at it indoors.
const STILL_ACQUIRING_MESSAGE_MS = 20_000;

/**
 * @param {number|null|undefined} latestAccuracyM - the most recent GPS
 *   fix's reported accuracy radius in meters, or null/undefined before
 *   any fix has arrived yet.
 * @param {number} [elapsedMsSinceStart] - how long this watch has been
 *   running — only used to decide when "still acquiring" has gone on
 *   long enough to say so explicitly; omit it to get the plain
 *   "Finding your location…" message unconditionally (e.g. in tests).
 * @returns {{level: string, message: string}}
 */
export function assessGpsSignalQuality(latestAccuracyM, elapsedMsSinceStart) {
  if (latestAccuracyM == null || !Number.isFinite(latestAccuracyM)) {
    return {
      level: GPS_SIGNAL_QUALITY.ACQUIRING,
      message:
        elapsedMsSinceStart != null && elapsedMsSinceStart >= STILL_ACQUIRING_MESSAGE_MS
          ? "Still no GPS signal — this usually means you're indoors or under cover. Move outside with a clear sky view to get a fix."
          : 'Finding your location…',
    };
  }
  const accuracy = Math.round(latestAccuracyM);
  if (latestAccuracyM <= STRONG_MAX_ACCURACY_M) {
    return { level: GPS_SIGNAL_QUALITY.STRONG, message: `Strong GPS signal (±${accuracy}m)` };
  }
  if (latestAccuracyM <= FAIR_MAX_ACCURACY_M) {
    return { level: GPS_SIGNAL_QUALITY.FAIR, message: `Fair GPS signal (±${accuracy}m)` };
  }
  return {
    level: GPS_SIGNAL_QUALITY.WEAK,
    message: `Weak GPS signal (±${accuracy}m) — some fixes are being dropped`,
  };
}
