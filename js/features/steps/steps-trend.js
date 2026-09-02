// Real insight from logged days, not just today's number — same principle
// as every other mini-app this session shipped (Sleep's streak, Heart
// Rate's trend, Meditate's streak, Vitals' streak).
/** Consecutive days ending at the most recent logged day, same
 *  UTC-day-string comparison as Sleep's calculateLoggingStreak — a day
 *  with a real logged step count (sensor or manual), any gap breaks it. */
export function calculateStepsStreak(entries) {
    if (entries.length === 0)
        return 0;
    const dates = [...new Set(entries.map((e) => e.date))].sort().reverse();
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