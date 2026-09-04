// The one "consecutive days ending today" streak algorithm every mini-app
// with a daily logging habit had ended up with its own copy of — Sleep's
// calculateLoggingStreak, Meditate's calculateMeditationStreak, Vitals'
// calculateVitalsStreak, Steps' calculateStepsStreak, Hydration's
// calculateHydrationStreak all did the exact same date-gap walk, each
// commenting that it matched the others. Extracted here as a real shared
// primitive instead of staying a fifth (now sixth, for Badges) copy — same
// "shared primitive, not another duplicate" call as js/lib/calendar-grid.ts.

/** Consecutive days ending at the most recent one, counting backward by
 *  calendar day — a gap of even one day breaks it. Dates are plain
 *  YYYY-MM-DD strings compared as UTC days; duplicates and any input
 *  order are fine. */
export function calculateStreak(dates: string[]): number {
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
