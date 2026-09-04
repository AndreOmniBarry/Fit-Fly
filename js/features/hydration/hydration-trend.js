// Real insight from logged drinks, not just today's total — same
// principle as every other mini-app this session shipped.
import { calculateStreak } from '../../lib/streak.js';
/** Several logs a day add up to one real daily total — this is the one
 *  place that grouping happens, so streak/average math never has to
 *  re-derive it. */
export function groupHydrationByDate(entries) {
    const totals = new Map();
    for (const entry of entries) {
        totals.set(entry.date, (totals.get(entry.date) ?? 0) + entry.amountMl);
    }
    return totals;
}
/** Consecutive days ending at the most recent logged day — a day with at
 *  least one real logged drink, any gap breaks it. Delegates to the same
 *  shared js/lib/streak.ts every other mini-app's streak does. */
export function calculateHydrationStreak(entries) {
    const totals = groupHydrationByDate(entries);
    return calculateStreak([...totals.keys()]);
}
/** The single highest daily total across a person's whole logged history
 *  — a real personal best, never scoped to a recent window (see
 *  listAllHydrationEntries()). Groups first (several drinks make one
 *  day's real total) then takes the max, same shape as the streak/
 *  average functions above. */
export function bestHydrationDayEver(entries) {
    const totals = groupHydrationByDate(entries);
    if (totals.size === 0)
        return null;
    let best = null;
    for (const [date, amountMl] of totals) {
        if (!best || amountMl > best.amountMl)
            best = { date, amountMl };
    }
    return best;
}
/** Real average per logged day across the last N calendar days —
 *  unlogged days dilute nothing, same "average per logged day, not per
 *  calendar day" choice as Nutrition's own weekly trend. */
export function averageHydrationPerLoggedDay(entries, days, today = new Date()) {
    const endDate = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const startDate = start.toISOString().slice(0, 10);
    const inWindow = entries.filter((e) => e.date >= startDate && e.date <= endDate);
    const totals = groupHydrationByDate(inWindow);
    if (totals.size === 0)
        return 0;
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return Math.round(sum / totals.size);
}
//# sourceMappingURL=hydration-trend.js.map