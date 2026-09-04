// Real insight from logged sessions, not just a list — same principle
// applied everywhere else in this app (Run's splits, Heart Rate's trend
// card, Nutrition's weekly average, Goals' milestones).
import { calculateStreak } from '../../lib/streak.js';
/** Current streak of consecutive days with at least one completed
 *  session, ending at the most recent one — a gap of even one day breaks
 *  it. Logging a session and logging a night are the same kind of "did
 *  this happen today" streak, so this delegates to the same shared
 *  js/lib/streak.ts every other mini-app's streak does. */
export function calculateMeditationStreak(sessions) {
    return calculateStreak(sessions.map((s) => s.date));
}
/** Total minutes practiced across the given sessions — rounded down, so
 *  a handful of seconds never inflates into a minute that wasn't really
 *  spent. */
export function totalMinutes(sessions) {
    const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    return Math.floor(totalSeconds / 60);
}
/** Sessions within the last `days` calendar days ending today (`today`
 *  injectable for testing, same pattern as
 *  js/features/nutrition/weekly-trend.js's lastNDaysRange). */
export function sessionsInLastNDays(sessions, days, today = new Date()) {
    const endDate = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const startDate = start.toISOString().slice(0, 10);
    return sessions.filter((s) => s.date >= startDate && s.date <= endDate);
}
//# sourceMappingURL=meditate-trends.js.map