// How a nap factors into rolling sleep debt — additive on top of, and
// deliberately never a replacement for, calculateSleepDebt's own
// night-only arithmetic (sleep-debt.ts, untouched by this module). The
// rule here is grounded in napping research, not a guess:
//
//   - A short nap is a real, measurable restorative benefit for
//     alertness and mood. The classic finding is Mednick, Nakayama &
//     Stickgold's nap-vs-caffeine-vs-placebo work ("The Restorative
//     Effect of Naps on Perceptual Deterioration", Nature Neuroscience,
//     2003; see also Mednick et al., Behavioural Brain Research, 2008)
//     plus the Sleep Foundation's own napping guidance, which recommends
//     roughly 20-30 minutes for exactly this reason.
//   - It is NOT a substitute for a real night's sleep. Longer naps run
//     into diminishing/mixed returns and real post-nap sleep inertia,
//     and can themselves erode the next night's sleep drive — the
//     literature is consistent that napping does not fully offset an
//     actual nightly deficit the way another full night's sleep would.
//
// So a nap credits toward debt reduction at a *fraction* of its own
// length (not 1:1), and that credit is capped well below what even a
// long nap could offset in a single day — a real, bounded benefit, never
// either "ignored entirely" or "counted the same as night sleep".
import { calculateSleepDebt, DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
import type { SleepDebtResult, SleepLog } from './types.js';

/** Only this fraction of a nap's minutes count toward debt reduction. */
export const NAP_DEBT_CREDIT_FRACTION = 0.3;

/** However long a day's naps add up to, at most this many minutes of
 *  debt can be credited from them for that single day. At the 30% rate
 *  this only binds past a combined ~3h20 of napping in one day — well
 *  beyond any length the napping literature treats as beneficial — so it
 *  exists purely as a backstop against a single very long nap pretending
 *  to erase most of a real nightly shortfall, not something a normal
 *  20-90 minute nap ever runs into. */
export const MAX_NAP_DEBT_CREDIT_MINUTES = 60;

/** One day's total nap credit, in minutes — a pure function of that
 *  day's total nap minutes (several short naps the same day are summed
 *  by the caller before this runs; see sumNapMinutes in
 *  js/db/repositories/nap-logs.ts). */
export function calculateNapDebtCredit(napMinutes: number): number {
  if (napMinutes <= 0) return 0;
  return Math.round(Math.min(MAX_NAP_DEBT_CREDIT_MINUTES, napMinutes * NAP_DEBT_CREDIT_FRACTION));
}

export interface NapLike {
  date: string;
  durationMinutes: number;
}

export interface NapAdjustedSleepDebtResult extends SleepDebtResult {
  /** Total nap credit actually applied across the window — each night's
   *  own credit is capped at that night's own shortfall (a nap can't
   *  create negative debt / a "banked" surplus for a night that already
   *  hit its goal), then summed. */
  napCreditMinutes: number;
  /** What debtMinutes would have been with no nap credit applied at all
   *  — the same number calculateSleepDebt itself would report — so a
   *  caller can show "X, Y thanks to naps" without a second recompute. */
  debtMinutesBeforeNapCredit: number;
}

/**
 * calculateSleepDebt's own per-night shortfall arithmetic, plus each
 * night's own nap credit (from naps logged on that same calendar date)
 * applied before summing. Purely additive: a window with no matching
 * naps returns exactly calculateSleepDebt's own numbers, with
 * napCreditMinutes 0 — existing callers that don't care about naps
 * should keep calling calculateSleepDebt directly; this is for call
 * sites that want the nap-aware figure specifically.
 *
 * @param recentLogs Same trailing window calculateSleepDebt takes.
 * @param naps Nap sessions to credit — several the same date are summed
 *   into that date's total before crediting.
 */
export function calculateSleepDebtWithNaps(
  recentLogs: SleepLog[],
  naps: NapLike[],
  goalMinutes: number = DEFAULT_SLEEP_GOAL_MINUTES
): NapAdjustedSleepDebtResult {
  const base = calculateSleepDebt(recentLogs, goalMinutes);

  if (recentLogs.length === 0) {
    return { ...base, napCreditMinutes: 0, debtMinutesBeforeNapCredit: base.debtMinutes };
  }

  const napMinutesByDate = new Map<string, number>();
  for (const nap of naps) {
    napMinutesByDate.set(nap.date, (napMinutesByDate.get(nap.date) ?? 0) + nap.durationMinutes);
  }

  let adjustedDebt = 0;
  let creditApplied = 0;
  for (const log of recentLogs) {
    const shortfall = Math.max(0, goalMinutes - log.durationMinutes);
    const napMinutesThatDay = napMinutesByDate.get(log.date) ?? 0;
    const credit = Math.min(shortfall, calculateNapDebtCredit(napMinutesThatDay));
    adjustedDebt += shortfall - credit;
    creditApplied += credit;
  }

  return {
    ...base,
    debtMinutes: Math.round(adjustedDebt),
    napCreditMinutes: Math.round(creditApplied),
    debtMinutesBeforeNapCredit: base.debtMinutes,
  };
}

/** A short, honest add-on sentence for the debt card's tooltip — null
 *  when no nap credit actually applied, so callers can skip appending
 *  anything rather than showing a hollow "0m from naps" note. */
export function describeNapDebtCredit(napCreditMinutes: number): string | null {
  if (napCreditMinutes <= 0) return null;
  const hours = Math.round((napCreditMinutes / 60) * 10) / 10;
  const amount = hours >= 1 ? `${hours}h` : `${napCreditMinutes}m`;
  return `Includes ${amount} credited back from napping (naps count partially toward debt, never 1:1 with a night's sleep).`;
}
