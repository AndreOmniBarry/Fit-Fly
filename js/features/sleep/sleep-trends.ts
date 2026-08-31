// Weekly trend aggregation for the Insights screen's bar strip — pure
// reshaping of whatever nights were actually logged, no interpolation for
// nights that weren't (an unlogged night is just absent, not assumed).
import type { SleepLog, SleepTrendNight } from './types.js';

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
  if (logs.length === 0) return 0;
  const dates = [...new Set(logs.map((log) => log.date))].sort().reverse();

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = dates[i - 1];
    const prior = dates[i];
    if (current == null || prior == null) break;
    const dayGap = (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${prior}T00:00:00Z`)) / 86_400_000;
    if (dayGap !== 1) break;
    streak++;
  }
  return streak;
}
