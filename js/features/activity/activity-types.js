// A small, static reference table of MET (Metabolic Equivalent of Task)
// values for the activity types quick-log supports. These are population
// averages from standard exercise-physiology compendia, not a measurement
// of any specific person — which is exactly why every calorie number
// derived from them is labeled ESTIMATED, never MEASURED, in the UI.

export const ACTIVITY_TYPES = Object.freeze([
  { id: 'walk', label: 'Walk', met: 3.5 },
  { id: 'run', label: 'Run', met: 9.8 },
  { id: 'cycle', label: 'Cycle', met: 7.5 },
  { id: 'strength', label: 'Strength Training', met: 5.0 },
  { id: 'yoga', label: 'Yoga', met: 2.5 },
  { id: 'swim', label: 'Swim', met: 6.0 },
  { id: 'hiit', label: 'HIIT', met: 8.0 },
  { id: 'other', label: 'Other', met: 4.0 },
]);

const BY_ID = new Map(ACTIVITY_TYPES.map((a) => [a.id, a]));

export function getActivityType(id) {
  return BY_ID.get(id);
}

export const INTENSITIES = Object.freeze([
  { id: 'light', label: 'Light', metMultiplier: 0.8 },
  { id: 'moderate', label: 'Moderate', metMultiplier: 1.0 },
  { id: 'vigorous', label: 'Vigorous', metMultiplier: 1.25 },
]);

const INTENSITY_BY_ID = new Map(INTENSITIES.map((i) => [i.id, i]));

export function getIntensity(id) {
  return INTENSITY_BY_ID.get(id);
}
