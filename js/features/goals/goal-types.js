// A real, named catalog of goal types — the parameters that actually
// make sense for "cardio endurance" aren't the parameters that make
// sense for "skill practice" or "a lift total", and the old one-size
// creation form never let that show. Picking a type here only tailors
// what the form *offers* (quick-pick units, a one-line hint) — it never
// changes the underlying math (goal-progress.js stays exactly as generic
// as it always was) and it's never required: Custom keeps the original
// fully-freeform behavior for anyone who'd rather just type their own
// unit.
//
// This is deliberately a short, real list, not an exhaustive taxonomy —
// see goal-activity.js's own doc comment on why guessing wrong is worse
// than staying generic. A goal created without picking one of these (or
// from before this existed) still classifies itself from its own
// name/unit the same way it always has.

export const GOAL_TYPES = Object.freeze([
  {
    id: 'cardio',
    label: 'Cardio Endurance',
    icon: 'heart-pulse',
    units: ['km', 'mi', 'min'],
    hint: 'Distance, time, or pace — whatever you\'re building toward.',
  },
  {
    id: 'strength',
    label: 'Strength',
    icon: 'dumbbell',
    units: ['kg', 'lb', 'reps'],
    hint: 'A lift total, a rep max, or the weight you\'re working up to.',
  },
  {
    id: 'skill',
    label: 'Skill Practice',
    icon: 'target',
    units: ['sessions', 'reps', 'days'],
    hint: 'Consistency and reps toward a specific movement or technique.',
  },
  {
    id: 'body',
    label: 'Body Composition',
    icon: 'gauge',
    units: ['kg', 'lb', '%'],
    hint: 'Bodyweight or body-fat — set the direction below to match whether you\'re bulking or cutting.',
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: 'sliders',
    units: [],
    hint: 'Anything else — name your own unit below.',
  },
]);

export function getGoalType(id) {
  return GOAL_TYPES.find((t) => t.id === id);
}
