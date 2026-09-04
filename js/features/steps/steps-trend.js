// Real insight from logged days, not just today's number — same principle
// as every other mini-app this session shipped (Sleep's streak, Heart
// Rate's trend, Meditate's streak, Vitals' streak).
import { calculateStreak } from '../../lib/streak.js';
/** Consecutive days ending at the most recent logged day — a day with a
 *  real logged step count (sensor or manual), any gap breaks it. Delegates
 *  to the same shared js/lib/streak.ts every other mini-app's streak does. */
export function calculateStepsStreak(entries) {
    return calculateStreak(entries.map((e) => e.date));
}
/** The single highest-steps day across a person's whole logged history —
 *  a real personal best, never scoped to a recent window (see
 *  listAllStepEntries()). A tie keeps whichever the array lists first,
 *  which callers should pass oldest-first so an actual tie reads as the
 *  first time it was reached, not an arbitrary later repeat. */
export function bestStepsDayEver(entries) {
    if (entries.length === 0)
        return null;
    return entries.reduce((best, entry) => (entry.steps > best.steps ? entry : best));
}
/** Real average across the last N calendar days, counting only days that
 *  actually have an entry — an unlogged day dilutes nothing, the same
 *  "average per logged day" choice Nutrition's own weekly trend makes. */
export function averageStepsPerLoggedDay(entries, days, today = new Date()) {
    const endDate = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const startDate = start.toISOString().slice(0, 10);
    const inWindow = entries.filter((e) => e.date >= startDate && e.date <= endDate);
    if (inWindow.length === 0)
        return 0;
    return Math.round(inWindow.reduce((sum, e) => sum + e.steps, 0) / inWindow.length);
}
//# sourceMappingURL=steps-trend.js.map