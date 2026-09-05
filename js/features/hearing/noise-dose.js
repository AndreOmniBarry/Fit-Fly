// Real occupational-audiology dose math — NIOSH's own noise-exposure
// standard (the same "equal energy," 3 dB exchange-rate, 85 dB/8-hour
// criterion already cited in noise-level.js's category thresholds)
// applied across a whole Monitor session's real timestamped readings,
// turning "here's a list of dB readings" into the same real "% of
// today's dose used" figure an occupational dosimeter reports — not a
// number invented for this app.
//
// Every input here is still built on noise-level.js's own uncalibrated-
// microphone estimate (see its module comment) — dose/TWA numbers below
// inherit that same honesty limit and are shown as estimates throughout
// the UI, never presented as compliance-grade measurement.

const CRITERION_LEVEL_DB = 85; // NIOSH's 8-hour permissible exposure limit
const CRITERION_HOURS = 8;
const EXCHANGE_RATE_DB = 3; // NIOSH's "equal energy" rate: permissible time halves every 3 dB up

/** Hours of exposure at `levelDb` before NIOSH's 8-hour dose limit is
 *  used up — e.g. 8h at 85dB, 4h at 88dB, 1h at 94dB, matching the same
 *  table noise-level.js's own category thresholds already cite. */
export function permissibleExposureHours(levelDb) {
  return CRITERION_HOURS / Math.pow(2, (levelDb - CRITERION_LEVEL_DB) / EXCHANGE_RATE_DB);
}

/**
 * @param {{estimatedDb: number, durationHours: number}[]} segments - each
 *   segment's own real dB reading and the real elapsed time it covers
 *   (the interval between two consecutive samples, or between session
 *   start and the first sample).
 * @returns {number} total dose as a percent of NIOSH's full daily
 *   permissible exposure — 100 means the day's whole allowance is used,
 *   200 means double, etc. Exactly 0 for no segments (never fabricated).
 */
export function calculateNoiseDosePercent(segments) {
  if (segments.length === 0) return 0;
  const dose = segments.reduce(
    (sum, seg) => sum + seg.durationHours / permissibleExposureHours(seg.estimatedDb),
    0
  );
  return Math.round(dose * 1000) / 10; // one decimal place — plenty of precision for an uncalibrated estimate
}

/** The single steady-state level that would have produced the same real
 *  dose over `totalHours` — NIOSH's own dose-to-TWA conversion, derived
 *  directly from permissibleExposureHours (dose = totalHours /
 *  permissibleExposureHours(TWA), solved for TWA), not a separately
 *  quoted formula that could drift out of sync with it. Reduces to
 *  NIOSH's commonly published `85 + 10*log10(D/100)` when totalHours is
 *  exactly 8 (that "10" is itself a rounding of this exact `3/log10(2)`
 *  ≈ 9.966 coefficient). Returns null for zero dose or zero duration —
 *  there's no real steady-state level for "no exposure happened". */
export function doseToTwa(dosePercent, totalHours) {
  if (dosePercent <= 0 || totalHours <= 0) return null;
  const doseFraction = dosePercent / 100;
  return Math.round(
    (CRITERION_LEVEL_DB + EXCHANGE_RATE_DB * Math.log2((CRITERION_HOURS * doseFraction) / totalHours)) * 10
  ) / 10;
}

// A jump-based heuristic for flagging a sudden loud moment within a
// session's own readings — a slammed door, a passing truck, a shout —
// distinct from "this reading happens to be loud" (already covered by
// noise-level.js's category breakdown). This is deliberately NOT
// presented as calibrated impulse-noise measurement (that needs a fast
// time-constant peak-SPL meter no browser can offer); it's a relative,
// same-session "level jumped a lot right here" flag.
const SPIKE_JUMP_DB = 15;

/**
 * @param {{estimatedDb: number, recordedAt: string}[]} samplesOldestFirst
 * @returns {{estimatedDb: number, recordedAt: string, jumpDb: number}[]}
 *   every sample whose level jumped by at least SPIKE_JUMP_DB over the
 *   immediately preceding sample.
 */
export function detectNoiseSpikes(samplesOldestFirst) {
  const spikes = [];
  for (let i = 1; i < samplesOldestFirst.length; i++) {
    const previous = samplesOldestFirst[i - 1];
    const current = samplesOldestFirst[i];
    const jumpDb = current.estimatedDb - previous.estimatedDb;
    if (jumpDb >= SPIKE_JUMP_DB) spikes.push({ ...current, jumpDb });
  }
  return spikes;
}

/** Turns a plain chronological sample list into the real duration
 *  segments calculateNoiseDosePercent needs — each sample's own dB
 *  reading paired with the real elapsed time since the previous one
 *  (the first sample gets no segment: there's nothing before it to
 *  measure a duration against, so it contributes 0 dose on its own,
 *  never a fabricated guessed duration). */
export function samplesToDoseSegments(samplesOldestFirst) {
  const segments = [];
  for (let i = 1; i < samplesOldestFirst.length; i++) {
    const previous = samplesOldestFirst[i - 1];
    const current = samplesOldestFirst[i];
    const durationHours =
      (new Date(current.recordedAt).getTime() - new Date(previous.recordedAt).getTime()) / 3_600_000;
    if (durationHours <= 0) continue; // clock skew/out-of-order data — never a negative or zero-length segment
    segments.push({ estimatedDb: current.estimatedDb, durationHours });
  }
  return segments;
}
