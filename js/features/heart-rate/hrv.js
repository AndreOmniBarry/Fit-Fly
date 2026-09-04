// Real HRV (heart rate variability) from a connected BLE strap's own
// RR-intervals — see ble-heart-rate.js's parseHeartRateMeasurement,
// which now extracts them instead of discarding them. Camera PPG and
// manual entries have no RR-intervals at all (a single BPM number can't
// derive variability), so HRV here is only ever real, measured data from
// a strap that actually reports it — never estimated, never backfilled
// from a bare heart rate.
//
// RMSSD (root mean square of successive differences between adjacent
// RR-intervals) is the standard, most widely-used time-domain HRV
// metric, and the one least sensitive to a short recording — appropriate
// here, where a session might only be a couple of minutes long, unlike
// the 5-minute+ recordings clinical HRV protocols usually call for. This
// is still shown as a live, in-session estimate, not a clinical reading.

const MIN_INTERVALS_FOR_RMSSD = 11; // 10 successive-difference pairs — a real floor, not a single noisy pair

/**
 * @param {number[]} rrIntervalsMs - in chronological order
 * @returns {number|null} RMSSD in milliseconds, or null with too few
 *   intervals accumulated yet to mean anything
 */
export function calculateRmssd(rrIntervalsMs) {
  if (rrIntervalsMs.length < MIN_INTERVALS_FOR_RMSSD) return null;

  const squaredDiffs = [];
  for (let i = 1; i < rrIntervalsMs.length; i++) {
    squaredDiffs.push((rrIntervalsMs[i] - rrIntervalsMs[i - 1]) ** 2);
  }
  const meanSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  return Math.round(Math.sqrt(meanSquaredDiff));
}
