// A strength session's calorie estimate — same shared MET-formula
// estimator as everywhere else in this app, applied to a real elapsed
// duration derived from the session's own logged sets rather than a
// guess: the time between the first and last set actually completed.

import { estimateActivityCalories } from './calorie-estimate.js';

const MIN_SETS_FOR_DURATION = 2; // a single set has no real elapsed range to measure

/**
 * @param {object} input
 * @param {{completedAt: string}[]} input.sets - every set logged for this session
 * @param {number|undefined} input.weightKg
 * @returns {{kcal:number, confidence:'low'|'medium', method:'met-formula'}|null}
 *   null with fewer than two sets (no real duration to derive), no
 *   weight on file, or a non-positive computed duration — never a
 *   fabricated duration in place of a real "can't say" answer.
 */
export function estimateStrengthSessionCalories({ sets, weightKg }) {
  if (sets.length < MIN_SETS_FOR_DURATION) return null;

  const timestamps = sets.map((s) => new Date(s.completedAt).getTime()).sort((a, b) => a - b);
  const durationMinutes = (timestamps[timestamps.length - 1] - timestamps[0]) / 60000;
  if (!(durationMinutes > 0)) return null;

  return estimateActivityCalories({
    activityTypeId: 'strength',
    intensityId: 'moderate', // no self-reported intensity for a strength session, same fallback Run uses for an unknown pace
    durationMinutes,
    weightKg,
  });
}
