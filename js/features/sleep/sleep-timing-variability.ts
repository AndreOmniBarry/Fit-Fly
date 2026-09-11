// Sleep Timing Variability — the night-to-night standard deviation of a
// person's *sleep midpoint* (bedtime plus half that night's logged
// duration), not just their bedtime. Distinct from
// calculateSleepConsistency (sleep-consistency.ts, bedtime only): this
// also catches nights where duration itself swings even while bedtime
// holds steady — e.g. bed at 11pm every night, but waking anywhere from
// 6am to 10am. Pure math, no I/O — same shape as this feature's other
// modules.
//
// Deliberately NOT called "Sleep Regularity Index" (SRI): Phillips et
// al. (2017)'s actual SRI needs continuous epoch-level sleep/wake
// sensor data — minute-by-minute sleep/wake state across the full
// day — that this app doesn't collect (Sleep is a manual bed/wake-time
// log, not a passive sensor; see types.ts's own honesty note on that).
// Claiming "SRI" here would be a fabricated precision this app can't
// back up. What's implemented instead is simpler and still real and
// separately validated in its own right: SD of sleep midpoint across
// recent nights. A 2025 10-year midlife cardiology cohort found both
// irregular bedtime AND irregular sleep midpoint (each as a 7-day SD)
// independently predicted higher risk of major adverse cardiac events —
// bedtime SD alone (already scored by sleep-consistency.ts) doesn't
// capture the duration-swing case this adds.
// "Sleep timing irregularity in midlife: association with incident
// major adverse cardiac events and cardiovascular disease mortality
// over a 10-year follow-up" (2025) — PMC13063869,
// https://pmc.ncbi.nlm.nih.gov/articles/PMC13063869/
import type { SleepLog } from './types.js';

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

export interface SleepTimingVariabilityResult {
  stdDevMinutes: number | null;
  nightsConsidered: number;
  elevated: boolean;
}

/** Same noon-shift trick as sleep-consistency.ts's minutesSinceNoon —
 *  keeps a time near midnight from reading as ~23.5 hours away from one
 *  just after it. */
function minutesSinceNoon(totalMinutes: number): number {
  return (totalMinutes - NOON_OFFSET_MINUTES + MINUTES_PER_DAY * 2) % MINUTES_PER_DAY;
}

/** Reads bedTime's UTC hour/minute on purpose, same deterministic
 *  "wall-clock reading the person entered" contract SleepLog documents —
 *  see types.ts. Null when a night has no bedTime logged: a duration-only
 *  log can't place a midpoint on the clock at all. */
function sleepMidpointMinutesSinceNoon(log: SleepLog): number | null {
  if (log.bedTime == null) return null;
  const bed = new Date(log.bedTime);
  const bedMinutes = bed.getUTCHours() * 60 + bed.getUTCMinutes();
  return minutesSinceNoon(bedMinutes + log.durationMinutes / 2);
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateSleepTimingVariability(recentLogs: SleepLog[]): SleepTimingVariabilityResult {
  const midpoints = recentLogs
    .map(sleepMidpointMinutesSinceNoon)
    .filter((m): m is number => m != null);

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
