// Real insight from a week of logging, not just "today's total" — the
// same "extract something from the data, don't just collect it"
// principle as Run's splits and Heart Rate's trend card.

const DEFAULT_WINDOW_DAYS = 7;

/** The [startDate, endDate] ('YYYY-MM-DD', both inclusive) for the last
 *  `days` calendar days ending today — `today` is injectable so this is
 *  testable without a real clock, same pattern as
 *  js/features/sleep/sleep-calendar.js's todayDate parameter. */
export function lastNDaysRange(days = DEFAULT_WINDOW_DAYS, today = new Date()) {
  const endDate = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);
  return { startDate, endDate, dayCount: days };
}

/**
 * @param {{date:string, calories:number, proteinG:number, carbsG:number, fatG:number, fiberG?:number}[]} entriesInWindow
 * @param {number} dayCount - the size of the window these entries were queried from (see lastNDaysRange)
 * @returns {{daysLogged:number, dayCount:number, avgCalories:number,
 *   avgProteinG:number, avgCarbsG:number, avgFatG:number, avgFiberG:number}|null}
 *   null with nothing logged in the window at all.
 */
export function summarizeWeeklyNutrition(entriesInWindow, dayCount = DEFAULT_WINDOW_DAYS) {
  const totalsByDate = new Map();
  for (const entry of entriesInWindow) {
    const totals = totalsByDate.get(entry.date) ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
    totals.calories += entry.calories ?? 0;
    totals.proteinG += entry.proteinG ?? 0;
    totals.carbsG += entry.carbsG ?? 0;
    totals.fatG += entry.fatG ?? 0;
    totals.fiberG += entry.fiberG ?? 0;
    totalsByDate.set(entry.date, totals);
  }

  const daysLogged = totalsByDate.size;
  if (daysLogged === 0) return null;

  const dailyTotals = [...totalsByDate.values()];
  const sum = (field) => dailyTotals.reduce((total, day) => total + day[field], 0);

  return {
    daysLogged,
    dayCount,
    // Average per *logged* day, not divided by the whole window — "what
    // a typical tracked day looked like," not silently pulled down by
    // days that were never logged (a real gap in consistency, but a
    // different fact from what a tracked day averages).
    avgCalories: Math.round(sum('calories') / daysLogged),
    avgProteinG: Math.round(sum('proteinG') / daysLogged),
    avgCarbsG: Math.round(sum('carbsG') / daysLogged),
    avgFatG: Math.round(sum('fatG') / daysLogged),
    avgFiberG: Math.round(sum('fiberG') / daysLogged),
  };
}
