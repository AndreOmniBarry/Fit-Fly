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
