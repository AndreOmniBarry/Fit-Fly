// Auto-splits: every time cumulative route distance crosses a fixed
// boundary (1km, or 1mi — whatever the caller passes), record how long
// that split took. This is the real, standard "splits" table any running
// watch shows — the single most useful mid-run/post-run number after
// total distance and time, and one this app didn't have at all before:
// it can tell you *which* part of the run was your fastest, not just the
// average for the whole thing.
//
// Deliberately a simple crossing-detection, not sub-point interpolation
// between the two points that straddle a boundary — GPS fixes are noisy
// enough already (see filterAccuratePoints) that claiming interpolated
// precision down to the meter would overclaim what the underlying data
// actually supports. The boundary is where the *point after* it crosses,
// same honesty tradeoff as the rest of this app's data.
import { haversineDistanceMeters } from './gps-math.js';

/** @param {{lat:number, lon:number, tMs:number}[]} points
 *  @param {number} splitMeters - e.g. 1000 for 1km splits, 1609.344 for 1mi
 *  @returns {{splitNumber:number, distanceMeters:number, durationMs:number}[]} */
export function computeSplits(points, splitMeters) {
  const splits = [];
  if (points.length < 2 || !(splitMeters > 0)) return splits;

  let cumulative = 0;
  let splitStartMs = points[0].tMs;
  let nextBoundary = splitMeters;

  for (let i = 1; i < points.length; i++) {
    cumulative += haversineDistanceMeters(points[i - 1], points[i]);
    while (cumulative >= nextBoundary) {
      splits.push({
        splitNumber: splits.length + 1,
        distanceMeters: splitMeters,
        durationMs: points[i].tMs - splitStartMs,
      });
      splitStartMs = points[i].tMs;
      nextBoundary += splitMeters;
    }
  }
  return splits;
}
