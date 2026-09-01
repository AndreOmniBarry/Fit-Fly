// Real progress-crossing detection — the basis for celebrating 25/50/75%
// the same way the app already celebrates 100% (isGoalAchieved), instead
// of going quiet until the very end. Deliberately excludes 100 — that's
// still goal-progress.js's own achieved/celebration path, unchanged.

export const MILESTONE_THRESHOLDS = Object.freeze([25, 50, 75]);

export const MILESTONE_MESSAGES = Object.freeze({
  25: 'A quarter of the way there.',
  50: 'Halfway there — keep going.',
  75: 'Almost there — final stretch.',
});

/** @returns {number[]} the thresholds newly crossed going from
 *  `previousPercent` to `currentPercent` — empty if none, and never the
 *  same threshold twice for a goal that was already past it. */
export function newlyCrossedMilestones(previousPercent, currentPercent) {
  return MILESTONE_THRESHOLDS.filter((t) => previousPercent < t && currentPercent >= t);
}
