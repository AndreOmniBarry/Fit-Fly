// Shared Sleep types — the on-disk record shape, plus the result shapes
// every pure-logic module (score/consistency/debt/trends) returns.

/** One logged night, keyed by the wake-up date (YYYY-MM-DD) — at most one
 *  per day, same convention as cycleLogs/readinessCheckins. Bed/wake times
 *  are optional: a quick "how many hours + how did it feel" log is the
 *  primary flow (nothing here pretends to have sensed sleep passively —
 *  see the README's honesty note), bed/wake times are there for anyone
 *  who wants richer consistency tracking. */
export interface SleepLog {
  date: string;
  /** ISO string whose UTC hour/minute encode the wall-clock bedtime the
   *  person entered — e.g. build it with `Date.UTC(y, m, d, hh, mm)`, not
   *  the local-timezone `Date` constructor. This keeps consistency math
   *  deterministic regardless of the device's own timezone, the same way
   *  `date` is a plain calendar string rather than a zoned instant. */
  bedTime: string | null;
  wakeTime: string | null;
  durationMinutes: number;
  quality: number | null;
  notes: string;
  loggedAt: string;
}

/** A daytime/afternoon nap — a second, distinct session from the night's
 *  own SleepLog, so a person can have both on the same `date` (naps live
 *  in their own store, js/db/repositories/nap-logs.ts, precisely so they
 *  never collide with sleepLogs' one-row-per-date key). Deliberately
 *  leaner than SleepLog (no quality rating, no notes) — a nap is a quick
 *  "I napped, here's roughly how long" log, not a full sleep diary entry.
 *  Several can exist for the same date (someone naps twice), same
 *  "multiple real entries per day" shape as nutritionEntries/
 *  hydrationEntries. */
export interface NapLog {
  id: string;
  date: string;
  /** Same UTC-wall-clock-encoding contract as SleepLog's bedTime/wakeTime
   *  — see that doc comment. Nulled out only if a caller ever saves a
   *  nap with just a duration and no clock times (not exercised by the
   *  current UI, which always collects both). */
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  loggedAt: string;
}

export type SleepCategory = 'poor' | 'fair' | 'good' | 'great';

export interface SleepScoreComponents {
  duration: number | null;
  consistency: number | null;
  quality: number | null;
}

export interface SleepScoreResult {
  score: number;
  category: SleepCategory;
  components: SleepScoreComponents;
  reasoning: string[];
}

export interface SleepConsistencyResult {
  score: number | null;
  varianceMinutes: number | null;
  nightsConsidered: number;
}

export interface SleepDebtResult {
  debtMinutes: number;
  nightsConsidered: number;
  goalMinutes: number;
  averageMinutes: number | null;
}

export interface SleepTrendNight {
  date: string;
  durationMinutes: number;
  isBest: boolean;
}
