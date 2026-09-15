// The one "consecutive days ending today" streak algorithm every mini-app
// with a daily logging habit had ended up with its own copy of — Sleep's
// calculateLoggingStreak, Meditate's calculateMeditationStreak, Vitals'
// calculateVitalsStreak, Steps' calculateStepsStreak, Hydration's
// calculateHydrationStreak, Hearing's own trend streak all did the exact
// same date-gap walk, each commenting that it matched the others.
// Extracted here as a real shared primitive instead of staying yet
// another copy — same "shared primitive, not another duplicate" call as
// js/lib/calendar-grid.ts. Fixing the grace-day behavior below here once
// fixes it for every one of those mini-apps at once, not six separate
// patches.
//
// One real missed day per rolling week doesn't zero the streak — a real,
// cited behavior change (Fit Fly's Phase-1 research pass), not a hunch.
// Duolingo's own Streak Freeze feature (data presented at ACM CHI 2019)
// measurably *increased* long-term retention (+23%) by removing exactly
// the "one missed day destroys everything" cliff-edge this function used
// to have — forgiveness helps retention, it doesn't undermine the habit
// the streak is meant to encourage. See GRACE_INTERVAL_DAYS below for the
// exact rule: this is deliberately not "N free passes, spend them
// whenever" (that would let someone bank up unused grace and use it as a
// license to skip a whole week early), and deliberately not "always
// forgive any single gap" either (that would make an every-other-day
// habit read identically to a real daily one) — a grace only becomes
// available again after a real, full week of actually-logged days since
// the last time one was used.
/** How many real (not forgiven) consecutive logged days must accumulate
 *  before another single missed day can be forgiven without breaking the
 *  streak. */
const GRACE_INTERVAL_DAYS = 7;
/** Consecutive days ending at the most recent one, counting backward by
 *  calendar day. A gap of exactly one missed day (two calendar days
 *  between two real logged dates) is forgiven — the streak "pauses" for
 *  that day rather than resetting — once every GRACE_INTERVAL_DAYS real
 *  logged days; any larger gap, or a second missed day before the next
 *  grace has re-accrued, still breaks it outright. Dates are plain
 *  YYYY-MM-DD strings compared as UTC days; duplicates and any input
 *  order are fine. The returned count is the number of real logged dates
 *  in the run — a forgiven gap day is never itself counted, since
 *  nothing was actually logged that day; it's just not treated as the
 *  end of the streak. */
export function calculateStreak(dates) {
    if (dates.length === 0)
        return 0;
    const uniqueDates = [...new Set(dates)].sort().reverse();
    let streak = 1;
    let realDaysSinceGrace = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
        const current = uniqueDates[i - 1];
        const prior = uniqueDates[i];
        if (current == null || prior == null)
            break;
        const dayGap = (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${prior}T00:00:00Z`)) / 86_400_000;
        if (dayGap === 1) {
            streak++;
            realDaysSinceGrace++;
            continue;
        }
        if (dayGap === 2 && realDaysSinceGrace >= GRACE_INTERVAL_DAYS) {
            streak++; // `prior` is a real logged day — only the gap itself is forgiven
            realDaysSinceGrace = 0;
            continue;
        }
        break;
    }
    return streak;
}
//# sourceMappingURL=streak.js.map