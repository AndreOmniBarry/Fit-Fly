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
