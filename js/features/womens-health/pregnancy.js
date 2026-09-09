// Due-date and gestational-age math — pure, no I/O, no PIN/ciphertext
// awareness, same separation cycle-prediction.js already keeps from the
// encrypted log records themselves. Naegele's rule (due date = last
// menstrual period + 280 days / 40 weeks) is the standard obstetric
// estimate cited by ACOG and used as the default due-date calculation in
// prenatal care — real, but still an estimate: only a small fraction of
// pregnancies deliver on the exact predicted date, so every readout that
// uses this stays worded as an estimate, never a certainty.

const NAEGELE_DAYS_FROM_LMP = 280;
const FULL_TERM_WEEKS = 40;

// Naegele's rule gives one point estimate, but only a small fraction of
// pregnancies actually deliver on that exact date — presenting it
// unqualified reads as far more certain than obstetric practice treats
// it. ACOG defines "early term" as starting at 37 weeks and "late term"
// as running through 41 weeks 6 days, with induction typically
// discussed at 42 — the real, cited clinical window most pregnancies
// deliver within, not a number this app invented. dueDateRange() below
// expresses that as real calendar dates around the single due date this
// module already computes, the same "estimate, not certainty" honesty
// every prediction in this app follows.
const TERM_RANGE_START_WEEKS = 37;
const TERM_RANGE_END_WEEKS = 42;

function daysBetween(isoDateA, isoDateB) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(isoDateB) - new Date(isoDateA)) / msPerDay);
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueDateFromLmp(lmpDate) {
  return addDays(lmpDate, NAEGELE_DAYS_FROM_LMP);
}

export function lmpFromDueDate(dueDate) {
  return addDays(dueDate, -NAEGELE_DAYS_FROM_LMP);
}

/** The real, cited clinical delivery window around the single Naegele
 *  due date — see the module-level TERM_RANGE_START_WEEKS/
 *  TERM_RANGE_END_WEEKS comment for where 37-42 weeks comes from.
 *  Takes the due date (not the LMP) since that's what every caller
 *  actually has on file, whichever way it was originally entered
 *  (direct due date, or converted from an LMP by dueDateFromLmp above)
 *  — lmpFromDueDate recovers the LMP this window is really anchored to.
 * @returns {{earliest: string, likely: string, latest: string}}
 */
export function dueDateRange(dueDate) {
  const lmp = lmpFromDueDate(dueDate);
  return {
    earliest: addDays(lmp, TERM_RANGE_START_WEEKS * 7),
    likely: dueDate,
    latest: addDays(lmp, TERM_RANGE_END_WEEKS * 7),
  };
}

/** @returns {{weeks:number, days:number}} gestational age as of
 *  `onDate` — clamped to never go negative (a due date entered for a
 *  pregnancy that hasn't reached its LMP-implied start yet) and never
 *  past a real full-term ceiling, so a stale/incorrect due date can't
 *  render an absurd age. */
export function gestationalAge(dueDate, onDate) {
  const lmp = lmpFromDueDate(dueDate);
  const totalDays = Math.max(0, Math.min(daysBetween(lmp, onDate), (FULL_TERM_WEEKS + 2) * 7));
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7 };
}

/** Positive while still pending, negative once past the estimated date —
 *  the caller decides how to word an overdue estimate, this just gives
 *  the real signed day count. */
export function daysUntilDue(dueDate, onDate) {
  return daysBetween(onDate, dueDate);
}

// Real, standard trimester week boundaries (ACOG/Mayo Clinic patient
// education materials) — weeks 1-13 first trimester, 14-27 second,
// 28-40+ third.
export function trimesterForWeek(week) {
  if (week < 14) return 1;
  if (week < 28) return 2;
  return 3;
}
