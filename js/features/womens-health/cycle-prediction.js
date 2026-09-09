// Cycle length/next-period/fertile-window/phase prediction from a plain
// list of past period start dates. Deliberately decoupled from the
// encrypted cycle-log records themselves (js/db/repositories/cycle-logs.js)
// — this module only ever sees dates (and, for period length, plain
// date+flow pairs) the caller has already decrypted, and never touches a
// PIN, a key, or ciphertext. Every prediction here is an estimate from a
// small, irregular biological sample, not a guarantee or a diagnosis —
// always shown with a confidence, never as a certainty (see the UI's own
// disclaimer copy next to wherever this is rendered).
//
// PHASE MODEL — the accepted textbook approximation this module encodes:
//   - Menstrual phase: the bleeding days themselves, day 1 through the
//     person's own average logged period length (falls back to a typical
//     5-day estimate with no history yet).
//   - Luteal phase: from ovulation to the next period is the most
//     hormonally consistent, relatively fixed part of a cycle (~14 days)
//     regardless of overall cycle length — LUTEAL_PHASE_DAYS below.
//   - Ovulation (the fertile window around it): centered ~14 days before
//     the next period, because counting backward from a *known* next
//     period is far more reliable than counting forward from a variable
//     last one — the whole reason predictNextPeriodStart itself only ever
//     extrapolates forward for the one cycle that hasn't happened yet.
//   - Follicular phase: everything between the end of menstrual bleeding
//     and the start of the ovulation window. This is deliberately the
//     "remainder" phase in every calculation below (see
//     classifyPhase/cyclePhaseSegments) because follicular length is the
//     one phase length that genuinely varies cycle-to-cycle — a longer or
//     shorter cycle is almost always a longer or shorter follicular
//     phase, not a longer or shorter luteal phase.

const DEFAULT_CYCLE_LENGTH_DAYS = 28;
export const DEFAULT_PERIOD_LENGTH_DAYS = 5; // typical average menstrual bleed length, used until real history exists
const LUTEAL_PHASE_DAYS = 14; // ovulation-to-next-period is the most consistent part of a cycle
const FERTILE_WINDOW_DAYS_BEFORE_OVULATION = 5;
const FERTILE_WINDOW_DAYS_AFTER_OVULATION = 1;

// A single predicted date, unqualified, reads as more certain than any
// cycle prediction actually is — real trackers publish a window, not a
// point. MIN_PREDICTION_MARGIN_DAYS is a floor even for someone with a
// long, near-perfectly regular history: real cycle timing still shifts
// day-to-day with stress, illness, travel, etc., so this app never
// claims tighter than ±2 days no matter how flat the person's own
// standard deviation comes out. SPARSE_HISTORY_MARGIN_DAYS is what's
// used before there's enough personal history to compute a real
// standard deviation at all (cycleLengthHistory needs 2+ gaps) — a
// published population-level cycle-variability figure standing in
// honestly for "not enough of your own data yet," never a falsely
// tight range dressed up as personal.
const MIN_PREDICTION_MARGIN_DAYS = 2;
const SPARSE_HISTORY_MARGIN_DAYS = 4;

function daysBetween(isoDateA, isoDateB) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(isoDateB) - new Date(isoDateA)) / msPerDay);
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function average(numbers) {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function standardDeviation(numbers) {
  const mean = average(numbers);
  return Math.sqrt(average(numbers.map((n) => (n - mean) ** 2)));
}

/** Real, dated cycle-length history — one entry per completed cycle, the
 *  gap between two consecutive logged period starts. Oldest first. Empty
 *  with fewer than 2 logged periods (there's no gap to measure yet), same
 *  "no gap, nothing to report" rule every function below follows. */
export function cycleLengthHistory(periodStartDates) {
  const sorted = [...periodStartDates].sort();
  const history = [];
  for (let i = 1; i < sorted.length; i++) {
    history.push({ periodStartDate: sorted[i], lengthDays: daysBetween(sorted[i - 1], sorted[i]) });
  }
  return history;
}

/** null with fewer than 2 logged periods — there's no gap to measure yet. */
export function averageCycleLengthDays(periodStartDates) {
  const history = cycleLengthHistory(periodStartDates);
  return history.length === 0 ? null : average(history.map((h) => h.lengthDays));
}

/** 'low' with under 3 cycles logged or highly irregular gaps; 'medium'
 *  otherwise; 'high' only with a longer, consistent history. Never
 *  fabricates confidence a 1-2-cycle history can't support. */
export function predictionConfidence(periodStartDates) {
  const gaps = cycleLengthHistory(periodStartDates).map((h) => h.lengthDays);
  if (gaps.length < 2) return 'low';

  const cv = standardDeviation(gaps) / average(gaps);
  if (gaps.length >= 4 && cv < 0.1) return 'high';
  if (cv < 0.2) return 'medium';
  return 'low';
}

/**
 * @param {string[]} periodStartDates - ISO date strings (YYYY-MM-DD)
 * @returns {string|null} predicted next period start date, or null with
 *   no history to extrapolate from at all
 */
export function predictNextPeriodStart(periodStartDates, { defaultCycleLengthDays = DEFAULT_CYCLE_LENGTH_DAYS } = {}) {
  if (periodStartDates.length === 0) return null;
  const sorted = [...periodStartDates].sort();
  const lastStart = sorted[sorted.length - 1];
  const cycleLength = averageCycleLengthDays(periodStartDates) ?? defaultCycleLengthDays;
  return addDays(lastStart, Math.round(cycleLength));
}

/** The same prediction as predictNextPeriodStart, widened into a real
 *  earliest–latest window instead of one unqualified date — see the
 *  module-level MIN_PREDICTION_MARGIN_DAYS/SPARSE_HISTORY_MARGIN_DAYS
 *  comment for where the margin itself comes from. Once there are
 *  enough logged cycles to compute a real personal standard deviation
 *  (cycleLengthHistory's own 2-gap floor), the margin is that person's
 *  own real day-to-day variability, rounded to a whole day and never
 *  let below the floor; before that, a published population-level
 *  figure stands in honestly rather than a falsely tight range.
 *
 * @returns {{earliest: string, likely: string, latest: string, marginDays: number}|null}
 *   null with no history to extrapolate from at all (same case
 *   predictNextPeriodStart itself returns null for).
 */
export function predictNextPeriodRange(periodStartDates, options) {
  const likely = predictNextPeriodStart(periodStartDates, options);
  if (!likely) return null;

  const gaps = cycleLengthHistory(periodStartDates).map((h) => h.lengthDays);
  const marginDays =
    gaps.length >= 2 ? Math.max(MIN_PREDICTION_MARGIN_DAYS, Math.round(standardDeviation(gaps))) : SPARSE_HISTORY_MARGIN_DAYS;

  return {
    earliest: addDays(likely, -marginDays),
    likely,
    latest: addDays(likely, marginDays),
    marginDays,
  };
}

/**
 * @returns {{start: string, end: string, ovulationDate: string}|null}
 */
export function predictFertileWindow(periodStartDates, options) {
  const nextStart = predictNextPeriodStart(periodStartDates, options);
  if (!nextStart) return null;

  const ovulationDate = addDays(nextStart, -LUTEAL_PHASE_DAYS);
  return {
    start: addDays(ovulationDate, -FERTILE_WINDOW_DAYS_BEFORE_OVULATION),
    end: addDays(ovulationDate, FERTILE_WINDOW_DAYS_AFTER_OVULATION),
    ovulationDate,
  };
}

/** The one place the 4-phase model (see the module doc comment above) is
 *  actually applied to a cycle day number. `cycleLengthDays` is the real
 *  or estimated length of *this specific* cycle (today's estimated one,
 *  or a past cycle's real, fully-logged one); `periodLengthDays` the
 *  real or estimated menstrual length. Both windows are counted from the
 *  cycle's *end* (day `cycleLengthDays`) backward, because ovulation-to-
 *  next-period is the fixed, reliable 14-day anchor — not from day 1
 *  forward, where only the period length is actually known up front. */
/** The cycle-day number that would be reached by counting `LUTEAL_PHASE_
 *  DAYS` back from the day *after* this cycle's last day (day
 *  `cycleLengthDays + 1`, i.e. the next period's own day 1) — the same
 *  "count back from the next period" the ovulation-date math above uses,
 *  just expressed as a day-number instead of a calendar date. */
function ovulationCycleDay(cycleLengthDays) {
  return cycleLengthDays - LUTEAL_PHASE_DAYS + 1;
}

function classifyPhase(cycleDayNumber, cycleLengthDays, periodLengthDays) {
  if (cycleDayNumber <= Math.round(periodLengthDays)) return 'menstrual';

  const ovulationDay = ovulationCycleDay(cycleLengthDays);
  const ovulationWindowStartDay = ovulationDay - FERTILE_WINDOW_DAYS_BEFORE_OVULATION;
  const ovulationWindowEndDay = ovulationDay + FERTILE_WINDOW_DAYS_AFTER_OVULATION;
  if (cycleDayNumber >= ovulationWindowStartDay && cycleDayNumber <= ovulationWindowEndDay) return 'ovulation';
  if (cycleDayNumber < ovulationWindowStartDay) return 'follicular';
  return 'luteal';
}

/** Where a given day sits in the cycle — a real, derived "Day N" count
 *  plus a phase bucket (menstrual/follicular/ovulation/luteal, see the
 *  module doc comment). Unlike a single-cycle model, this looks across
 *  *all* logged period starts, not just the most recent one: `onDate` is
 *  placed in whichever logged cycle actually contains it, so a calendar
 *  can be color-coded by phase for past months too, not only "now".
 *
 *  For a past, fully-closed cycle (a later real period start already
 *  exists), the cycle's own real length is used instead of the average —
 *  real data always beats an estimate when it's available. Only the
 *  *current*, still-open cycle (today's) falls back to the estimated
 *  average/default cycle length, and only that cycle can ever resolve to
 *  `null` once it runs past the estimated next start — genuinely
 *  uncertain territory (a new period may already be running late, or
 *  just hasn't been logged yet) rather than a guess.
 *
 * @returns {{cycleDayNumber: number, phase: 'menstrual'|'follicular'|'ovulation'|'luteal'}|null}
 *   null with no history at all, with `onDate` before every logged
 *   period, or once the current open cycle is past its estimated next
 *   start.
 */
export function currentCyclePhase(periodStartDates, onDate, options) {
  if (periodStartDates.length === 0) return null;
  const sorted = [...periodStartDates].sort();

  // The period start that actually opened the cycle `onDate` falls in —
  // the closest logged start at or before onDate, not necessarily the
  // most recent one overall.
  const enclosingStart = [...sorted].reverse().find((d) => d <= onDate);
  if (!enclosingStart) return null; // onDate is before any logged period

  const cycleDayNumber = daysBetween(enclosingStart, onDate) + 1; // day 1 = the period's own start date
  const nextActualStart = sorted.find((d) => d > enclosingStart);
  const periodLengthDays = options?.averagePeriodLengthDays ?? DEFAULT_PERIOD_LENGTH_DAYS;

  if (nextActualStart) {
    // A fully-closed historical cycle — its real length, not an estimate.
    const cycleLengthDays = daysBetween(enclosingStart, nextActualStart);
    return { cycleDayNumber, phase: classifyPhase(cycleDayNumber, cycleLengthDays, periodLengthDays) };
  }

  // The current, still-open cycle — only place an estimate is used.
  const nextStart = predictNextPeriodStart(periodStartDates, options);
  if (nextStart && onDate >= nextStart) return null;
  const cycleLengthDays = nextStart
    ? daysBetween(enclosingStart, nextStart)
    : options?.defaultCycleLengthDays ?? DEFAULT_CYCLE_LENGTH_DAYS;
  return { cycleDayNumber, phase: classifyPhase(cycleDayNumber, cycleLengthDays, periodLengthDays) };
}

/** The real, proportional shape of the *current* estimated cycle, split
 *  into the same 4 phases — for drawing an actual segmented phase bar
 *  instead of a plain text label. Every length here comes from a real
 *  computation (the user's own averages, or the same defaults every other
 *  function here falls back to); nothing is fabricated. Menstrual and
 *  ovulation are pinned to their own estimated lengths; luteal is pinned
 *  to the fixed LUTEAL_PHASE_DAYS anchor described in the module doc
 *  comment; follicular absorbs whatever's left of the cycle, which is
 *  deliberate — see the doc comment for why that's the phase whose real
 *  length is supposed to vary.
 * @returns {{cycleLengthDays:number, menstrualDays:number, follicularDays:number, ovulationDays:number, lutealDays:number}|null}
 *   null with no logged history at all.
 */
export function cyclePhaseSegments(periodStartDates, options) {
  if (periodStartDates.length === 0) return null;

  const cycleLengthDays = Math.round(
    averageCycleLengthDays(periodStartDates) ?? options?.defaultCycleLengthDays ?? DEFAULT_CYCLE_LENGTH_DAYS
  );
  const periodLengthDays = Math.round(options?.averagePeriodLengthDays ?? DEFAULT_PERIOD_LENGTH_DAYS);

  const ovulationDay = ovulationCycleDay(cycleLengthDays);
  const ovulationWindowStartDay = ovulationDay - FERTILE_WINDOW_DAYS_BEFORE_OVULATION;
  const ovulationWindowEndDay = ovulationDay + FERTILE_WINDOW_DAYS_AFTER_OVULATION;

  const menstrualDays = Math.min(periodLengthDays, cycleLengthDays);
  const ovulationDays = Math.max(1, ovulationWindowEndDay - ovulationWindowStartDay + 1);
  const lutealDays = Math.max(1, cycleLengthDays - ovulationWindowEndDay);
  // Follicular is the remainder (see the module doc comment) — clamped at
  // 0 for a cycle short enough, or a period long enough, that there's
  // nothing left over; the bar's real proportions still sum correctly
  // since every renderer divides by the actual segment total, not by
  // cycleLengthDays itself.
  const follicularDays = Math.max(0, cycleLengthDays - menstrualDays - ovulationDays - lutealDays);

  return { cycleLengthDays, menstrualDays, follicularDays, ovulationDays, lutealDays };
}
