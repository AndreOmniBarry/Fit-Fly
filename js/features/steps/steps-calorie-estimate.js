// A day's step count converted to an estimated calorie burn — reuses the
// exact same MET-formula estimator Activity logging and Run mode already
// share (activity/calorie-estimate.js), no second number-fabricating
// path. There's no duration recorded alongside a step count, only the
// total itself, so this first estimates a real duration from a published
// average walking cadence, then hands that to the same estimator every
// other calorie number in this app already uses.

import { estimateActivityCalories } from '../activity/calorie-estimate.js';

// ~100 steps/minute is the commonly cited moderate-intensity walking
// cadence threshold from step-based physical-activity research (e.g.
// Tudor-Locke et al.) — used here only to convert a raw step count into
// an estimated duration, never presented on its own as a measurement.
const ASSUMED_STEPS_PER_MINUTE = 100;

/**
 * @param {object} input
 * @param {number} input.steps
 * @param {number|undefined} input.weightKg
 * @returns {{kcal:number, confidence:'low'|'medium', method:'met-formula'}|null}
 *   null exactly when calorie-estimate.js's own estimator would return
 *   null (no weight on file, or no steps to estimate from) — never a
 *   fabricated number in place of a real "can't say" answer.
 */
export function estimateStepsCalories({ steps, weightKg }) {
  if (!(steps > 0)) return null;
  return estimateActivityCalories({
    activityTypeId: 'walk',
    intensityId: 'moderate',
    durationMinutes: steps / ASSUMED_STEPS_PER_MINUTE,
    weightKg,
  });
}
