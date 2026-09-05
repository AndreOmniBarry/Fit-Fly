// A real pure-tone hearing screening test — the same underlying idea
// clinical audiometry uses (present a tone, find the quietest level a
// person can still hear, at each of several standard frequencies, in
// each ear separately) adapted honestly to a browser's real limits.
//
// What this genuinely is: a relative, same-device screening estimate.
// What it is NOT, and never claims to be: a calibrated audiogram. A
// browser has no way to know a speaker or headphone's real acoustic
// output level — that number depends on the specific hardware, its
// volume setting, and how it's worn, none of which a web page can read
// or calibrate against a reference source. So every "threshold" here is
// a *gain fraction* (0-1, this device's own output range) at which a
// person first reported hearing a tone — never a dB HL (hearing level)
// figure, which only means something against a clinically calibrated
// reference. Comparing gain thresholds *across frequencies in the same
// test* (is 4kHz notably harder to hear than 1kHz?) and *across repeat
// tests on the same device* (has a frequency's threshold crept up over
// months?) are both still real, valid signals even without calibration
// — comparing to some absolute "normal hearing" number is not, and this
// module never attempts to.
//
// The staircase itself is a single ascending sweep per frequency/ear —
// simpler and faster than clinical audiometry's own repeated descending/
// ascending bracketing (the real Hughson-Westlake method), appropriate
// for a quick screening estimate, not a diagnostic threshold. Real
// smartphone-hearing-screening research (e.g. the WHO's own hearWHO
// app) uses this same simplification for exactly this reason.

// Standard audiometric octave test frequencies (the same set clinical
// pure-tone audiometry tests, aside from the least diagnostically useful
// very-low/very-high extremes) — high-frequency loss (4-8 kHz) is the
// earliest and most common pattern in both noise-induced and
// age-related hearing loss, so these frequencies specifically are worth
// testing even in a screening tool.
export const TEST_FREQUENCIES_HZ = Object.freeze([250, 500, 1000, 2000, 4000, 8000]);

export const EARS = Object.freeze(['left', 'right']);

const DEFAULT_START_GAIN = 0.04; // quiet, near-inaudible starting point on a typical device
const DEFAULT_STEP_GAIN = 0.04;
const DEFAULT_MAX_GAIN = 1;

/**
 * A single ascending staircase for one frequency/ear: starts quiet,
 * steps up by a fixed amount every time the tone plays and isn't heard,
 * and records the gain at the moment it *is* heard as that combination's
 * threshold. Pure state machine — no audio playback here (see
 * pure-tone-generator.js for that); a caller drives it by actually
 * playing a tone at getCurrentGain() and then calling reportHeard() or
 * reportNotHeard() based on the person's real response.
 */
export function createAscendingStaircase({
  startGain = DEFAULT_START_GAIN,
  stepGain = DEFAULT_STEP_GAIN,
  maxGain = DEFAULT_MAX_GAIN,
} = {}) {
  let currentGain = startGain;
  let finished = false;
  let thresholdGain = null;

  return {
    getCurrentGain: () => currentGain,
    isFinished: () => finished,
    /** The gain the tone first became audible at, or null if the
     *  staircase reached maxGain with no response — a real "couldn't
     *  find a threshold on this device," never a fabricated number. */
    getThresholdGain: () => thresholdGain,

    /** Call after playing the current tone if the person indicated they
     *  heard it. */
    reportHeard() {
      if (finished) return;
      thresholdGain = currentGain;
      finished = true;
    },

    /** Call after playing the current tone if the person didn't
     *  indicate hearing it (or a real response-timeout elapsed). */
    reportNotHeard() {
      if (finished) return;
      if (currentGain >= maxGain) {
        finished = true;
        thresholdGain = null; // never heard, even at this device's max output
        return;
      }
      currentGain = Math.min(maxGain, currentGain + stepGain);
    },
  };
}

/** A real early-warning signal built entirely from relative comparisons
 *  within one test — no absolute dB HL claim, just "these frequencies
 *  needed notably more gain than this same person's own best frequency,
 *  on this same test, on this same device." NOTABLE_GAP is in the same
 *  0-1 gain units the staircase itself steps in — roughly 6 real steps
 *  at the default 0.04 step size, comfortably past normal frequency-to-
 *  frequency variation.
 *  @param {{frequencyHz:number, ear:string, thresholdGain:number|null}[]} results
 *  @returns {number[]} the frequencies (Hz) flagged as notably elevated */
const NOTABLE_GAP = 0.25;

export function flagElevatedThresholds(results) {
  const heard = results.filter((r) => r.thresholdGain != null);
  if (heard.length < 2) return [];
  const best = Math.min(...heard.map((r) => r.thresholdGain));
  return [...new Set(heard.filter((r) => r.thresholdGain - best >= NOTABLE_GAP).map((r) => r.frequencyHz))];
}

/** Every frequency/ear that was never heard at all, even at this
 *  device's maximum output — deliberately kept separate from
 *  flagElevatedThresholds (which only ever compares real heard
 *  thresholds against each other): "needed somewhat more volume" and
 *  "didn't hear it even at max" are different severities, and merging
 *  them would bury the more concerning result inside a milder-sounding
 *  one. Not deduped across ears (unlike flagElevatedThresholds' own
 *  summary) — asymmetry between ears is itself a meaningful, real
 *  clinical signal worth keeping visible per-ear.
 *  @param {{frequencyHz:number, ear:string, thresholdGain:number|null}[]} results
 *  @returns {{frequencyHz:number, ear:string}[]} */
export function notDetectedResults(results) {
  return results.filter((r) => r.thresholdGain == null).map((r) => ({ frequencyHz: r.frequencyHz, ear: r.ear }));
}

/** Compares the same frequency/ear combination across two completed
 *  tests — the real early-detection value this whole feature is for:
 *  hearing loss develops gradually, so a single test's absolute numbers
 *  matter far less than whether *this same person, on this same device*
 *  needed meaningfully more gain to hear the same tone than they did
 *  last time. Only ever compares like-for-like (same frequency, same
 *  ear, both tests actually found a threshold) — a "couldn't hear it at
 *  all this time" result where last time it was heard is itself flagged
 *  as a real, meaningful worsening, not silently skipped.
 *  @returns {{frequencyHz:number, ear:string, earlierGain:number, laterGain:number|null, worsenedByGain:number}[]}
 *    only the combinations that got meaningfully worse, most-worsened first. */
const MEANINGFUL_WORSENING_GAP = 0.15;

export function compareThresholdChange(earlierResults, laterResults) {
  const changes = [];
  for (const earlier of earlierResults) {
    if (earlier.thresholdGain == null) continue; // nothing to compare a worsening against
    const later = laterResults.find((r) => r.frequencyHz === earlier.frequencyHz && r.ear === earlier.ear);
    if (!later) continue;

    const worsenedByGain = later.thresholdGain == null ? DEFAULT_MAX_GAIN - earlier.thresholdGain : later.thresholdGain - earlier.thresholdGain;
    if (worsenedByGain >= MEANINGFUL_WORSENING_GAP) {
      changes.push({
        frequencyHz: earlier.frequencyHz,
        ear: earlier.ear,
        earlierGain: earlier.thresholdGain,
        laterGain: later.thresholdGain,
        worsenedByGain: Math.round(worsenedByGain * 100) / 100,
      });
    }
  }
  return changes.sort((a, b) => b.worsenedByGain - a.worsenedByGain);
}
