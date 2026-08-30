// Cycle length/next-period/fertile-window prediction from a plain list
// of past period start dates. Deliberately decoupled from the encrypted
// cycle-log records themselves (js/db/repositories/cycle-logs.js) — this
// module only ever sees dates the caller has already decrypted, and
// never touches a PIN, a key, or ciphertext. Every prediction here is an
// estimate from a small, irregular biological sample, not a guarantee —
// always shown with a confidence, never as a certainty.

const DEFAULT_CYCLE_LENGTH_DAYS = 28;
const LUTEAL_PHASE_DAYS = 14; // ovulation-to-next-period is the most consistent part of a cycle
const FERTILE_WINDOW_DAYS_BEFORE_OVULATION = 5;
const FERTILE_WINDOW_DAYS_AFTER_OVULATION = 1;

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

/** Gaps (in days) between consecutive period start dates, oldest first. */
function cycleLengthGaps(periodStartDates) {
  const sorted = [...periodStartDates].sort();
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }
  return gaps;
}

/** null with fewer than 2 logged periods — there's no gap to measure yet. */
export function averageCycleLengthDays(periodStartDates) {
  const gaps = cycleLengthGaps(periodStartDates);
  return gaps.length === 0 ? null : average(gaps);
}

/** 'low' with under 3 cycles logged or highly irregular gaps; 'medium'
 *  otherwise; 'high' only with a longer, consistent history. Never
 *  fabricates confidence a 1-2-cycle history can't support. */
export function predictionConfidence(periodStartDates) {
  const gaps = cycleLengthGaps(periodStartDates);
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
