// Standard heart-rate zone classification for a single spot-check reading
// (camera, BLE strap, or manual) — not an exercise-session zone tracker,
// just an honest "where does this number sit" read on the latest reading
// card. Pure and DOM-free, same discipline as ppg-signal.js/signal-quality.js.
//
// With a real birthdate on file, zones are a percentage of an
// age-predicted maximum heart rate, using the Tanaka formula:
//   HRmax = 208 - 0.7 x age
// (Tanaka, Monahan, Seals, "Age-Predicted Maximal Heart Rate Revisited",
// J Am Coll Cardiol 2001;37(1):153-6 — a meta-analysis of 18,712 subjects
// that fits real data noticeably better than the older "220 - age" rule of
// thumb, especially past 40.)
//
// The percentage thresholds themselves are the American Heart
// Association's own published target-heart-rate-zone boundaries
// (heart.org, "Target Heart Rates Chart"): moderate activity sits at
// roughly 50-70% of HRmax, vigorous activity at 70-85%. Below 50% reads as
// this app's "resting" zone; 50% up through that 85% vigorous-effort
// ceiling reads as "elevated"; at or above 85% reads as "high" — real
// exertion, worth noting if the reading was meant to be taken at rest.
//
// Without a birthdate on file, age is unknown — rather than guess one,
// this falls back to fixed adult clinical thresholds instead: a normal
// resting adult heart rate is 60-100 bpm (AHA), so 100 bpm and up already
// reads as "elevated" and a sustained 140+ reads as "high" (tachycardia
// territory for someone at rest) regardless of age.
//
// Purely informational, like the app's blood-pressure/SpO2 categories —
// never a diagnosis.

export const HR_ZONE = Object.freeze({
  RESTING: 'resting',
  ELEVATED: 'elevated',
  HIGH: 'high',
});

const RESTING_MAX_PCT_OF_HRMAX = 0.5; // AHA moderate-activity zone floor
const HIGH_MIN_PCT_OF_HRMAX = 0.85; // AHA vigorous-activity zone ceiling

const NO_AGE_ELEVATED_MIN_BPM = 100; // AHA: normal resting adult HR tops out at 100
const NO_AGE_HIGH_MIN_BPM = 140;

/** @param {number|null|undefined} age - whole years
 *  @returns {number|null} estimated max heart rate in bpm, or null when
 *   age isn't a usable positive number (age unknown) */
export function estimateMaxHeartRate(age) {
  if (!(age > 0)) return null;
  return 208 - 0.7 * age;
}

/** @param {number} bpm
 *  @param {number|null} [age] - the person's age, if known (from their
 *   profile's birthdate) — omit/null to use the fixed no-age fallback
 *  @returns {'resting'|'elevated'|'high'|null} null only when bpm itself
 *   isn't a usable positive number */
export function classifyHeartRateZone(bpm, age = null) {
  if (!(bpm > 0)) return null;

  const maxHr = estimateMaxHeartRate(age);
  if (maxHr != null) {
    const pctOfMax = bpm / maxHr;
    if (pctOfMax >= HIGH_MIN_PCT_OF_HRMAX) return HR_ZONE.HIGH;
    if (pctOfMax >= RESTING_MAX_PCT_OF_HRMAX) return HR_ZONE.ELEVATED;
    return HR_ZONE.RESTING;
  }

  if (bpm >= NO_AGE_HIGH_MIN_BPM) return HR_ZONE.HIGH;
  if (bpm >= NO_AGE_ELEVATED_MIN_BPM) return HR_ZONE.ELEVATED;
  return HR_ZONE.RESTING;
}

const ZONE_LABEL = {
  [HR_ZONE.RESTING]: 'Resting',
  [HR_ZONE.ELEVATED]: 'Elevated',
  [HR_ZONE.HIGH]: 'High',
};

export function describeHeartRateZone(zone) {
  return ZONE_LABEL[zone] ?? '—';
}

/** True only for "high" — the one zone this app visually flags, same
 *  is-concerning contract as Vitals' blood-pressure/SpO2 categories. */
export function isConcerningHeartRateZone(zone) {
  return zone === HR_ZONE.HIGH;
}
