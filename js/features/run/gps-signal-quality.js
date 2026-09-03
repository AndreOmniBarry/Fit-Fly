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

/**
 * @param {number|null|undefined} latestAccuracyM - the most recent GPS
 *   fix's reported accuracy radius in meters, or null/undefined before
 *   any fix has arrived yet.
 * @returns {{level: string, message: string}}
 */
export function assessGpsSignalQuality(latestAccuracyM) {
  if (latestAccuracyM == null || !Number.isFinite(latestAccuracyM)) {
    return { level: GPS_SIGNAL_QUALITY.ACQUIRING, message: 'Finding your location…' };
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
