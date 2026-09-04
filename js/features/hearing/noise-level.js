// Ambient sound-level estimation from a phone microphone — real signal
// processing (RMS -> dBFS -> an estimated real-world dB reading) on a
// genuinely uncalibrated sensor. This is not a certified sound level
// meter: a browser gives no access to a microphone's real sensitivity,
// which varies by device, and there's no way to calibrate against a
// reference source on-device. Every reading here is shown as an ESTIMATE,
// never presented as a precise measurement — same honesty contract as
// js/features/heart-rate/ppg-signal.js's camera-PPG estimate.
//
// The dBFS -> "real world" dB conversion below uses a fixed reference
// offset (REFERENCE_OFFSET_DB) based on published typical smartphone
// electret-microphone sensitivity (roughly -42 dBFS at 94 dB SPL,
// unprocessed, 0 dB digital gain — the same rough calibration figure
// several open-source phone-mic sound-level-meter projects use in the
// absence of per-device calibration). It will run high or low on any
// specific device; the category thresholds below are deliberately wide
// enough that this app is useful for spotting real patterns (a
// consistently loud commute, a loud show) rather than for precise
// occupational compliance measurement.

const SILENCE_FLOOR_DBFS = -100; // avoids -Infinity from a true-zero (silent) buffer
const REFERENCE_OFFSET_DB = 136; // see comment above: -42 dBFS + 136 = 94 dB SPL

/** Root-mean-square amplitude of a buffer of [-1, 1] time-domain audio
 *  samples (e.g. from AnalyserNode.getFloatTimeDomainData) — the
 *  standard measure of a signal's average power. */
export function computeRms(samples) {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
  return Math.sqrt(sumSquares / samples.length);
}

/** RMS amplitude (0-1) to dBFS (decibels relative to full digital
 *  scale) — always <= 0, more negative the quieter the signal. */
export function rmsToDbfs(rms) {
  if (rms <= 0) return SILENCE_FLOOR_DBFS;
  return Math.max(SILENCE_FLOOR_DBFS, 20 * Math.log10(rms));
}

/** dBFS to an estimated real-world dB reading — see the module-level
 *  comment for the honest limits of this conversion. */
export function dbfsToEstimatedDb(dbfs) {
  return Math.round(dbfs + REFERENCE_OFFSET_DB);
}

// Category thresholds cited from real published exposure guidance:
// NIOSH's permissible occupational noise exposure limits (85 dB = 8
// hours, halving the safe duration for every 3 dB increase — the
// "equal energy" 3 dB exchange rate: 88 dB = 4h, 91 dB = 2h, 94 dB = 1h)
// and the WHO's "Make Listening Safe" recreational guidance (100 dB
// safe for at most 15 minutes/week). <60/60-70/70-80 dB reference
// figures (quiet room, conversation, city traffic) are standard
// acoustics-textbook environmental noise benchmarks.
const CATEGORIES = Object.freeze([
  { max: 60, category: 'quiet', label: 'Quiet', message: 'A quiet room or library — no exposure risk.' },
  { max: 70, category: 'moderate', label: 'Moderate', message: 'Normal conversation level — no exposure risk.' },
  { max: 80, category: 'loud', label: 'Loud', message: 'Busy traffic or a vacuum cleaner — fine briefly, tiring over hours.' },
  {
    max: 85,
    category: 'very-loud',
    label: 'Very loud',
    message: 'Approaching NIOSH\'s 85 dB / 8-hour permissible exposure limit.',
  },
  {
    max: 100,
    category: 'harmful',
    label: 'Harmful with prolonged exposure',
    message: 'NIOSH\'s safe exposure time roughly halves every 3 dB above 85 — minutes matter here, not hours.',
  },
  {
    max: Infinity,
    category: 'dangerous',
    label: 'Dangerous',
    message: 'The WHO puts safe exposure at 100 dB for at most 15 minutes a week — hearing protection recommended.',
  },
]);

/** @returns {{category: string, label: string, message: string}} */
export function classifyNoiseLevel(estimatedDb) {
  return CATEGORIES.find((c) => estimatedDb < c.max) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** One instantaneous reading from a single buffer — used for a live
 *  in-progress readout during capture. */
export function estimateSoundLevelFromSamples(samples) {
  const estimatedDb = dbfsToEstimatedDb(rmsToDbfs(computeRms(samples)));
  return { estimatedDb, ...classifyNoiseLevel(estimatedDb) };
}

/** The real "equivalent continuous level" (Leq) across a whole capture —
 *  acoustic levels must be averaged in the power domain, not the log
 *  (dB) domain, or a brief loud moment gets diluted the same as it would
 *  be by naively averaging dB numbers directly. Takes the RMS values
 *  already computed per poll during capture (see noise-capture.js),
 *  averages their squares (mean power), then converts that single
 *  average back to dB once.
 *  @param {number[]} rmsReadings
 *  @returns {{estimatedDb: number, category: string, label: string, message: string}|null}
 *    null if given no readings at all — never a fabricated 0 dB result. */
export function estimateEquivalentSoundLevel(rmsReadings) {
  if (rmsReadings.length === 0) return null;
  const meanPower = rmsReadings.reduce((sum, rms) => sum + rms * rms, 0) / rmsReadings.length;
  const equivalentRms = Math.sqrt(meanPower);
  const estimatedDb = dbfsToEstimatedDb(rmsToDbfs(equivalentRms));
  return { estimatedDb, ...classifyNoiseLevel(estimatedDb) };
}
