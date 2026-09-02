// Real insight from logged drinks, not just today's total — same
// principle as every other mini-app this session shipped.
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
/** Consecutive days ending at the most recent logged day, same
 *  UTC-day-string comparison as Sleep's calculateLoggingStreak — a day
 *  with at least one real logged drink, any gap breaks it. */
export function calculateHydrationStreak(entries) {
    const totals = groupHydrationByDate(entries);
    const dates = [...totals.keys()].sort().reverse();
    if (dates.length === 0)
        return 0;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
        const current = dates[i - 1];
        const prior = dates[i];
        if (current == null || prior == null)
            break;
        const dayGap = (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${prior}T00:00:00Z`)) / 86_400_000;
        if (dayGap !== 1)
            break;
        streak++;
    }
    return streak;
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