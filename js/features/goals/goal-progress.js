// Generic progress math that works for any numeric goal — a target
// bodyweight, a weekly activity-days count, a run distance, a custom
// number someone names themselves — as long as it knows where the value
// started, where it is now, and where it's headed. One implementation,
// reused by every goal type, rather than a bespoke calculation per type.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {object} input
 * @param {number} input.startValue - the value when the goal was created
 * @param {number} input.currentValue - the latest known value
 * @param {number} input.targetValue
 * @returns {number} 0-100, clamped — how far from start to target the
 *   current value has traveled, regardless of whether the goal is to
 *   increase or decrease
 */
export function calculateProgressPercent({ startValue, currentValue, targetValue }) {
  if (startValue === targetValue) {
    return currentValue === targetValue ? 100 : 0;
  }
  const totalDelta = targetValue - startValue;
  const currentDelta = currentValue - startValue;
  return clamp((currentDelta / totalDelta) * 100, 0, 100);
}

/**
 * @param {'increase'|'decrease'} direction - whether the target is
 *   reached by going up (e.g. weekly activity days) or down (e.g. a
 *   weight-loss target)
 */
export function isGoalAchieved({ direction, currentValue, targetValue }) {
  return direction === 'decrease' ? currentValue <= targetValue : currentValue >= targetValue;
}

/** null with no deadline set — a goal doesn't have to be time-bound. */
export function daysUntilDeadline(deadlineIsoDate, nowIsoDate = new Date().toISOString().slice(0, 10)) {
  if (!deadlineIsoDate) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(deadlineIsoDate) - new Date(nowIsoDate)) / msPerDay);
}
