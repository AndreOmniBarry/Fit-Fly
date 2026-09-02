// Same consecutive-day-ending-today streak math as Sleep's
// calculateLoggingStreak and Meditate's calculateMeditationStreak — a day
// counts if it has at least one blood-pressure OR SpO2 reading logged
// (either type), since both live under this one Vitals mini-app and the
// Hub tile shows one combined streak, not two competing numbers.

/** @param dates 'YYYY-MM-DD' strings, one per reading (BP and SpO2
 *  combined) — duplicates and any order are fine. */
export function calculateVitalsStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const uniqueDates = [...new Set(dates)].sort().reverse();

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const current = uniqueDates[i - 1];
    const prior = uniqueDates[i];
    if (current == null || prior == null) break;
    const dayGap = (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${prior}T00:00:00Z`)) / 86_400_000;
    if (dayGap !== 1) break;
    streak++;
  }
  return streak;
}
