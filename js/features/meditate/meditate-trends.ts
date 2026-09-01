// Real insight from logged sessions, not just a list — same principle
// applied everywhere else in this app (Run's splits, Heart Rate's trend
// card, Nutrition's weekly average, Goals' milestones).

export interface MeditationSessionRecord {
  date: string; // 'YYYY-MM-DD'
  durationSeconds: number;
}

/** Current streak of consecutive days with at least one completed
 *  session, ending at the most recent one — a gap of even one day breaks
 *  it. Same shape and same UTC-day-string comparison as Sleep's
 *  calculateLoggingStreak (js/features/sleep/sleep-trends.ts) — logging a
 *  session and logging a night are the same kind of "did this happen
 *  today" streak. */
export function calculateMeditationStreak(sessions: MeditationSessionRecord[]): number {
  if (sessions.length === 0) return 0;
  const dates = [...new Set(sessions.map((s) => s.date))].sort().reverse();

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

/** Total minutes practiced across the given sessions — rounded down, so
 *  a handful of seconds never inflates into a minute that wasn't really
 *  spent. */
export function totalMinutes(sessions: MeditationSessionRecord[]): number {
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  return Math.floor(totalSeconds / 60);
}

/** Sessions within the last `days` calendar days ending today (`today`
 *  injectable for testing, same pattern as
 *  js/features/nutrition/weekly-trend.js's lastNDaysRange). */
export function sessionsInLastNDays(
  sessions: MeditationSessionRecord[],
  days: number,
  today: Date = new Date()
): MeditationSessionRecord[] {
  const endDate = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= startDate && s.date <= endDate);
}
