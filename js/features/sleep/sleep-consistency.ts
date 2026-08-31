// Bedtime consistency — how tightly clustered recent bedtimes are, which
// matters for sleep quality independently of raw duration. Pure math, no
// I/O: callers pass in whatever logs they already fetched.
import type { SleepConsistencyResult, SleepLog } from './types.js';

const MINUTES_PER_DAY = 1440;
const NOON_OFFSET_MINUTES = 720;

/** Shifts a clock time so "noon" is the zero point instead of midnight —
 *  the standard trick for measuring bedtime spread without a fake jump at
 *  midnight (23:45 and 00:15 are 30 minutes apart, not ~23.5 hours).
 *  Reads the UTC components on purpose, not local ones — see types.ts:
 *  a bedTime's UTC hour/minute *is* the wall-clock reading the person
 *  entered, by construction, so this is deterministic regardless of the
 *  machine's own timezone (the test runner's included). */
function minutesSinceNoon(isoDateTime: string): number {
  const d = new Date(isoDateTime);
  const totalMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  return ((totalMinutes - NOON_OFFSET_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** A stddev of 0 scores 100; a stddev of two hours (120 min) or more
 *  scores 0, linear in between. Two hours of night-to-night bedtime
 *  swing is a reasonable "consistency has broken down" line without
 *  punishing the ordinary 20-40 minute drift most people have. */
const ZERO_SCORE_STDDEV_MINUTES = 120;

export function calculateSleepConsistency(recentLogs: SleepLog[]): SleepConsistencyResult {
  const bedTimes = recentLogs
    .map((log) => log.bedTime)
    .filter((bedTime): bedTime is string => bedTime != null);

  if (bedTimes.length < 2) {
    // Consistency is a night-to-night comparison — one data point (or
    // zero) can't say anything about it yet.
    return { score: null, varianceMinutes: null, nightsConsidered: bedTimes.length };
  }

  const shifted = bedTimes.map(minutesSinceNoon);
  const stdDev = standardDeviation(shifted);
  const score = Math.round(
    Math.min(100, Math.max(0, 100 - (stdDev / ZERO_SCORE_STDDEV_MINUTES) * 100))
  );

  return { score, varianceMinutes: Math.round(stdDev), nightsConsidered: bedTimes.length };
}
