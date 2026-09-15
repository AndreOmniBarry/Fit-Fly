const MINUTES_PER_DAY = 1440;
const NOON_OFFSET_MINUTES = 720;
const MIN_NIGHTS = 2;
// A round, app-chosen line — not a cutoff drawn from the study above
// (which compared population tertiles, not a fixed threshold). Flagged
// "elevated" once night-to-night midpoint swing averages more than an
// hour and a half, deliberately looser than sleep-consistency.ts's own
// 2-hour "consistency has broken down" line since this stacks two
// sources of swing (bedtime and duration) rather than one.
const ELEVATED_STDDEV_MINUTES = 90;
/** Same noon-shift trick as sleep-consistency.ts's minutesSinceNoon —
 *  keeps a time near midnight from reading as ~23.5 hours away from one
 *  just after it. */
function minutesSinceNoon(totalMinutes) {
    return (totalMinutes - NOON_OFFSET_MINUTES + MINUTES_PER_DAY * 2) % MINUTES_PER_DAY;
}
/** Reads bedTime's UTC hour/minute on purpose, same deterministic
 *  "wall-clock reading the person entered" contract SleepLog documents —
 *  see types.ts. Null when a night has no bedTime logged: a duration-only
 *  log can't place a midpoint on the clock at all. */
function sleepMidpointMinutesSinceNoon(log) {
    if (log.bedTime == null)
        return null;
    const bed = new Date(log.bedTime);
    const bedMinutes = bed.getUTCHours() * 60 + bed.getUTCMinutes();
    return minutesSinceNoon(bedMinutes + log.durationMinutes / 2);
}
function standardDeviation(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}
export function calculateSleepTimingVariability(recentLogs) {
    const midpoints = recentLogs
        .map(sleepMidpointMinutesSinceNoon)
        .filter((m) => m != null);
    if (midpoints.length < MIN_NIGHTS) {
        return { stdDevMinutes: null, nightsConsidered: midpoints.length, elevated: false };
    }
    const stdDev = standardDeviation(midpoints);
    return {
        stdDevMinutes: Math.round(stdDev),
        nightsConsidered: midpoints.length,
        elevated: stdDev > ELEVATED_STDDEV_MINUTES,
    };
}
//# sourceMappingURL=sleep-timing-variability.js.map