// Weekly trend aggregation for the Insights screen's bar strip — pure
// reshaping of whatever nights were actually logged, no interpolation for
// nights that weren't (an unlogged night is just absent, not assumed).
import type { SleepLog, SleepTrendNight } from './types.js';
import { calculateStreak } from '../../lib/streak.js';

/** Sorted oldest-to-newest, with the single longest night flagged
 *  `isBest` (the first one found, if there's an exact tie). */
export function buildWeeklyTrend(logs: SleepLog[]): SleepTrendNight[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const maxDuration = sorted.reduce((max, log) => Math.max(max, log.durationMinutes), -Infinity);
  let bestFound = false;

  return sorted.map((log) => {
    const isBest = !bestFound && log.durationMinutes === maxDuration;
    if (isBest) bestFound = true;
    return { date: log.date, durationMinutes: log.durationMinutes, isBest };
  });
}

/** Current streak of consecutive logged nights ending at the most recent
 *  entry, counting backward by calendar day — a gap of even one night
 *  breaks it. Dates are plain YYYY-MM-DD strings compared as UTC days. */
export function calculateLoggingStreak(logs: SleepLog[]): number {
  return calculateStreak(logs.map((log) => log.date));
}

/** The single longest night across a person's whole logged history — a
 *  real personal best, never scoped to a recent window, same "an actual
 *  record, not a recent-window illusion" contract as Hydration/Steps' own
 *  bestXDayEver. A tie keeps whichever the array lists first, so callers
 *  should pass logs oldest-first for an exact tie to read as the first
 *  time it was reached, not an arbitrary later repeat. */
export function bestSleepNightEver(logs: SleepLog[]): SleepLog | null {
  if (logs.length === 0) return null;
  return logs.reduce((best, log) => (log.durationMinutes > best.durationMinutes ? log : best));
}
