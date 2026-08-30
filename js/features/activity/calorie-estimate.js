// Calories burned is never something this app can *measure* — there's no
// sensor for it — so every number here is estimated from a standard MET
// formula and always carries a confidence, never fabricated precision
// (rounded to the nearest 5 kcal, not a false-precise decimal).

import { getActivityType, getIntensity } from './activity-types.js';

/** kcal/min = METs x 3.5 x bodyweight(kg) / 200 — the standard ACSM formula. */
function metFormulaKcal(met, weightKg, durationMinutes) {
  return ((met * 3.5 * weightKg) / 200) * durationMinutes;
}

/**
 * @param {object} input
 * @param {string} input.activityTypeId - id from activity-types.js's ACTIVITY_TYPES
 * @param {string} input.intensityId - id from activity-types.js's INTENSITIES
 * @param {number} input.durationMinutes
 * @param {number} input.weightKg
 * @returns {{kcal: number, confidence: 'low'|'medium', method: 'met-formula'}|null}
 */
export function estimateActivityCalories({ activityTypeId, intensityId, durationMinutes, weightKg }) {
  const activity = getActivityType(activityTypeId);
  const intensity = getIntensity(intensityId);
  if (!activity || !intensity || !(durationMinutes > 0) || !(weightKg > 0)) return null;

  const adjustedMet = activity.met * intensity.metMultiplier;
  const rawKcal = metFormulaKcal(adjustedMet, weightKg, durationMinutes);

  return {
    kcal: Math.round(rawKcal / 5) * 5,
    // A generic MET table applied to a specific person is a rough
    // estimate at best — 'other' has no matched MET value at all, so it
    // gets the lower of the two confidence levels this app ever shows
    // for calorie estimates (there is no 'high': that would require an
    // actual sensor, which this app doesn't have).
    confidence: activityTypeId === 'other' ? 'low' : 'medium',
    method: 'met-formula',
  };
}
