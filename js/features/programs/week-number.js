const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** 1-based week number since a program started, from ISO timestamps. Week
 *  1 covers [startedAt, startedAt+7d), week 2 the next 7 days, and so on.
 *  Clamped to 1 even if `now` is somehow before `startedAt`. */
export function getCurrentWeekNumber(startedAtIso, nowIso = new Date().toISOString()) {
  const elapsedMs = new Date(nowIso).getTime() - new Date(startedAtIso).getTime();
  return Math.max(1, Math.floor(elapsedMs / MS_PER_WEEK) + 1);
}
