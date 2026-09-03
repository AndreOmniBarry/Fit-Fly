// A run's calorie estimate reuses the exact same MET-formula estimator
// Activity logging already has (activity/calorie-estimate.js) — no
// second number-fabricating path — but Run mode can do one better than
// the manually-picked intensity Activity logging needs: infer it from
// the run's own real recorded average pace, since actual effort is
// already sitting right there in the data instead of needing to be
// self-reported after the fact. Still always ESTIMATED, never MEASURED —
// there's no calorie sensor here, same honesty as every other calorie
// number in this app.

import { estimateActivityCalories } from '../activity/calorie-estimate.js';

// Boundaries a recreational runner would recognize: sub-5:00/km reads as
// a genuinely hard effort, 5:00-7:00/km as a steady comfortable run,
// slower than that as an easy jog — mapped onto the same three
// intensity tiers Activity logging's own dropdown already offers.
const VIGOROUS_MAX_SEC_PER_KM = 300;
const MODERATE_MAX_SEC_PER_KM = 420;

/** Maps a run's real average pace onto one of the app's existing
 *  intensity tiers. A `null` pace (nothing measurable yet) falls back to
 *  'moderate' — the same blind guess a person would otherwise have to
 *  make picking from Activity's own dropdown. */
export function intensityFromPaceSecPerKm(avgPaceSecPerKm) {
  if (avgPaceSecPerKm == null) return 'moderate';
  if (avgPaceSecPerKm <= VIGOROUS_MAX_SEC_PER_KM) return 'vigorous';
  if (avgPaceSecPerKm <= MODERATE_MAX_SEC_PER_KM) return 'moderate';
  return 'light';
}

/**
 * @param {object} input
 * @param {number} input.durationMs
 * @param {number|null} input.avgPaceSecPerKm
 * @param {number|undefined} input.weightKg
 * @returns {{kcal:number, confidence:'low'|'medium', method:'met-formula'}|null}
 *   null exactly when calorie-estimate.js's own estimator would return
 *   null (no weight on file, or nothing to estimate from yet) — never a
 *   fabricated number in place of a real "can't say" answer.
 */
export function estimateRunCalories({ durationMs, avgPaceSecPerKm, weightKg }) {
  return estimateActivityCalories({
    activityTypeId: 'run',
    intensityId: intensityFromPaceSecPerKm(avgPaceSecPerKm),
    durationMinutes: durationMs / 60000,
    weightKg,
  });
}
