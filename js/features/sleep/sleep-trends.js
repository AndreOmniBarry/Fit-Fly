import { calculateStreak } from '../../lib/streak.js';
/** Sorted oldest-to-newest, with the single longest night flagged
 *  `isBest` (the first one found, if there's an exact tie). */
export function buildWeeklyTrend(logs) {
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const maxDuration = sorted.reduce((max, log) => Math.max(max, log.durationMinutes), -Infinity);
    let bestFound = false;
    return sorted.map((log) => {
        const isBest = !bestFound && log.durationMinutes === maxDuration;
        if (isBest)
            bestFound = true;
        return { date: log.date, durationMinutes: log.durationMinutes, isBest };
    });
}
/** Current streak of consecutive logged nights ending at the most recent
 *  entry, counting backward by calendar day — a gap of even one night
 *  breaks it. Dates are plain YYYY-MM-DD strings compared as UTC days. */
export function calculateLoggingStreak(logs) {
    return calculateStreak(logs.map((log) => log.date));
}
//# sourceMappingURL=sleep-trends.js.map