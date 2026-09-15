// A person's own rolling personal HRV baseline, and how their most recent
// real BLE-derived RMSSD reading (see hrv.js) deviates from it. Pure math,
// no I/O — same shape as this app's other trailing-history modules
// (js/features/programs/training-load.js's ACWR, js/features/womens-health/
// cycle-prediction.js). Callers (js/features/sleep/sleep-view.ts's own
// Readiness check-in save path) fetch real heart-rate samples themselves
// and pass them in.
//
// Why baseline-relative, not an absolute "good RMSSD" number: normal,
// healthy RMSSD varies enormously between people — age, sex, fitness, and
// genetics all shift it — and there is no single population "good" value
// to compare against. Nunan D, Sandercock GR, Brodie DA. "A Quantitative
// Systematic Review of Normal Values for Short-Term Heart Rate Variability
// in Healthy Adults." Pacing Clin Electrophysiol. 2010;33(11):1407-1417
// found enormous inter-individual variation in published normal HRV values
// even among healthy adults, and called out the field's own habit of
// treating disparate values as directly comparable.
//
// What IS a real, cited, useful signal: a person's own recent HRV
// relative to THEIR OWN rolling baseline. Plews DJ, Laursen PB, Stanley
// J, Kilding AE, Buchheit M. "Training Adaptation and Heart Rate
// Variability in Elite Endurance Athletes: Opening the Door to Effective
// Monitoring." Sports Med. 2013;43(9):773-781 (PMID 23852425) argues
// explicitly that valid HRV interpretation needs within-athlete
// longitudinal baselines rather than group/population norms, and
// recommends Ln rMSSD as the most reliable day-to-day metric. Plews DJ,
// Laursen PB, Kilding AE, Buchheit M. "Heart rate variability in elite
// triathletes, is variation in variability the key to effective
// training? A case comparison." Eur J Appl Physiol. 2012;112(11):
// 3729-3741 is where the practical method below comes from: a trailing
// 7-day rolling average of Ln rMSSD as the personal baseline (smoothing
// real day-to-day noise while staying sensitive to real change), with a
// minimum of ~3 real readings across that week before a baseline means
// anything — fewer than that isn't a real weekly average, just noise. A
// real, sustained drop below that rolling baseline is what their case
// data (and later fatigue-monitoring literature) associates with
// accumulated fatigue / incomplete recovery or progression toward
// non-functional overreaching.
//
// One real simplification vs. that cited method, disclosed rather than
// implied away: Plews et al.'s own baseline/deviation math runs on
// Ln-transformed rMSSD (the standard correction for rMSSD's own
// right-skewed distribution); this module compares raw rmssdMs percent
// deviation instead. For the moderate week-to-week swings this module's
// NOTABLE_DEVIATION_PERCENT/HRV_LARGE_DEVIATION_PERCENT bands actually
// flag, a raw-vs-ln percent deviation is a close approximation, but it
// is not literally their method — noted here rather than overclaimed.
//
// Important honesty note, also straight from this literature: unlike
// this app's ACWR (training-load.js), where the "bad" direction is
// unambiguous (higher ratio = higher injury risk), HRV deviation is NOT simply
// "lower is always bad, higher is always better." Plews et al. 2013
// themselves note elite-athlete HRV responses to training can be
// equivocal — atypical DECREASES have coincided with genuine positive
// fitness adaptation, and unusually large swings in EITHER direction can
// reflect incomplete recovery rather than one of them cleanly meaning
// "great." This module still treats a real drop below baseline as the
// more consistently-cited fatigue signal (see below), but callers should
// not over-read a large rise as automatically good — see readiness.js's
// own reasoning text for how this gets phrased to a person.
//
// This is still not a clinical HRV protocol: a consumer BLE chest/wrist
// strap over a session that might only be a couple of minutes long is a
// real but imperfect readiness signal, not a diagnosis (see hrv.js's own
// doc comment on RMSSD/session-length tradeoffs).

/** Trailing window Plews et al. 2012's own rolling-average method uses to
 *  smooth real day-to-day HRV noise into a personal baseline. */
const BASELINE_WINDOW_DAYS = 7;

/** Plews et al. 2013's own recommended floor: "a minimum of three
 *  (ideally, randomly selected) measures of Ln rMSSD per week" for a
 *  real weekly average — fewer real readings than this in the trailing
 *  window isn't a real baseline, it's 1-2 noisy data points dressed up
 *  as one (see this module's own "never fabricate a baseline from sparse
 *  data" rule, same spirit as training-load.js's MIN_HISTORY_DAYS_FOR_RATIO). */
const MIN_READINGS_FOR_BASELINE = 3;

// This app's own interpretive band for calling a deviation "notable"
// enough to name a direction, rather than reading as everyday noise —
// unlike ACWR's 0.8/1.3/1.5 (each a specific number drawn straight from
// Gabbett 2016), this percentage is NOT itself a number pulled from the
// Plews papers above (their own method is a statistical smallest-
// worthwhile-change/coefficient-of-variation analysis, not implemented
// here) — it's a plain, symmetric, reasonably conservative convention so
// this module never over-calls ordinary day-to-day drift as meaningful.
const NOTABLE_DEVIATION_PERCENT = 7.5;

// How far below baseline this module's own score curve (see readiness.js's
// hrvScore) treats as "as bad as this signal gets" — a real, substantial,
// sustained drop, not itself a specific literature-cited cutoff (same
// "reasonable heuristic, honestly not over-claimed as a cited threshold"
// spirit as NOTABLE_DEVIATION_PERCENT above).
export const HRV_LARGE_DEVIATION_PERCENT = 20;

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function addDays(dateKey, delta) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Same local-calendar-day rule already established elsewhere for
 *  grouping same-day readings (see training-load.js's own localDateKey)
 *  — a per-module copy, same as that one, rather than a shared
 *  cross-feature import for one small function. */
function localDateKey(isoTimestamp) {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Turns real BLE heart-rate samples that carry a real rmssdMs (see
 * js/db/repositories/heart-rate.js) into one real HRV reading per
 * calendar day. Multiple real readings on the same real day are
 * AVERAGED, not summed — HRV isn't a cumulative quantity the way
 * training load is (dailyTrainingLoadsFromSessions sums for exactly that
 * reason; this doesn't, for the opposite one). A day with no qualifying
 * sample simply has no entry — never a fabricated 0 (0ms RMSSD isn't a
 * real "no HRV today", it's nonsense).
 *
 * @param {{recordedAt: string, rmssdMs?: number|null}[]} samples - real
 *   heart-rate samples, already filtered by the caller to source==='ble'
 *   (samples with no rmssdMs at all are skipped here regardless, so
 *   passing the whole unfiltered list is harmless, just wasteful)
 * @returns {{date: string, rmssdMs: number}[]}
 */
export function dailyHrvFromSamples(samples) {
  const byDate = new Map();
  for (const sample of samples) {
    if (sample.rmssdMs == null) continue;
    const date = localDateKey(sample.recordedAt);
    const values = byDate.get(date) ?? [];
    values.push(sample.rmssdMs);
    byDate.set(date, values);
  }
  return Array.from(byDate, ([date, values]) => ({ date, rmssdMs: Math.round(average(values)) }));
}

function categorizeDeviation(deviationPercent) {
  if (deviationPercent <= -NOTABLE_DEVIATION_PERCENT) return 'below-baseline';
  if (deviationPercent >= NOTABLE_DEVIATION_PERCENT) return 'above-baseline';
  return 'at-baseline';
}

/**
 * The most recent real HRV reading on/before `asOfDate`, this person's
 * own trailing rolling baseline from the real readings before it, and
 * how far the latest one deviates — see this module's own doc comment
 * for the real citations behind "compare to your own baseline" and the
 * honesty note on why a rise isn't unambiguously "better."
 *
 * @param {{date: string, rmssdMs: number}[]} dailyReadings - real,
 *   one-per-day HRV readings (see dailyHrvFromSamples)
 * @param {string} asOfDate - YYYY-MM-DD to evaluate as of
 * @returns {{
 *   latestDate: string|null,
 *   latestRmssdMs: number|null,
 *   baselineRmssdMs: number|null,
 *   deviationMs: number|null,
 *   deviationPercent: number|null,
 *   category: 'below-baseline'|'at-baseline'|'above-baseline'|null,
 *   readingsInBaseline: number
 * }} every field but readingsInBaseline (and latestDate/latestRmssdMs,
 *   once there's at least one real reading) is null until there's
 *   really enough trailing history for a real baseline — never a
 *   baseline fabricated from 1-2 readings.
 */
export function calculateHrvBaselineDeviation(dailyReadings, asOfDate) {
  const relevant = dailyReadings.filter((r) => r.date <= asOfDate).sort((a, b) => (a.date < b.date ? -1 : 1));

  if (relevant.length === 0) {
    return {
      latestDate: null,
      latestRmssdMs: null,
      baselineRmssdMs: null,
      deviationMs: null,
      deviationPercent: null,
      category: null,
      readingsInBaseline: 0,
    };
  }

  const latest = relevant[relevant.length - 1];
  const windowStart = addDays(latest.date, -BASELINE_WINDOW_DAYS);
  // Strictly BEFORE the latest reading's own date — today's/the latest
  // reading never gets to inform its own baseline, same "deviation from
  // what came before it" logic as any other trailing-baseline comparison
  // in this app.
  const priorReadings = relevant.filter((r) => r.date < latest.date && r.date >= windowStart);

  if (priorReadings.length < MIN_READINGS_FOR_BASELINE) {
    return {
      latestDate: latest.date,
      latestRmssdMs: latest.rmssdMs,
      baselineRmssdMs: null,
      deviationMs: null,
      deviationPercent: null,
      category: null,
      readingsInBaseline: priorReadings.length,
    };
  }

  const baselineRmssdMs = average(priorReadings.map((r) => r.rmssdMs));
  const deviationMs = latest.rmssdMs - baselineRmssdMs;
  const deviationPercent = Math.round((deviationMs / baselineRmssdMs) * 1000) / 10; // one decimal place

  return {
    latestDate: latest.date,
    latestRmssdMs: latest.rmssdMs,
    baselineRmssdMs: Math.round(baselineRmssdMs),
    deviationMs: Math.round(deviationMs),
    deviationPercent,
    category: categorizeDeviation(deviationPercent),
    readingsInBaseline: priorReadings.length,
  };
}
