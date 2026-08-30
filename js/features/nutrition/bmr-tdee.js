// BMR/TDEE math. Both are population-average formulas, not a metabolic
// measurement — real individual variation runs ±10% or more even with
// perfect inputs — so every number derived from them is shown as a
// range with a confidence, never a single fabricated-precise calorie
// count. See tdeeConfidenceBand().

/** Mifflin-St Jeor, the most widely validated BMR formula. `sex` values
 *  other than 'male'/'female' (e.g. 'prefer-not-to-say') average the two
 *  sex-specific constants rather than forcing a binary choice — still an
 *  estimate either way, just a fair one. */
export function calculateBmr({ sex, weightKg, heightCm, age }) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // average of +5 and -161
}

/** Coarse activity-level tiers off self-reported weekly active days —
 *  the standard Harris-Benedict-style multiplier buckets. */
const ACTIVITY_TIERS = Object.freeze([
  { maxDays: 1, multiplier: 1.2 }, // sedentary
  { maxDays: 3, multiplier: 1.375 }, // lightly active
  { maxDays: 5, multiplier: 1.55 }, // moderately active
  { maxDays: 6, multiplier: 1.725 }, // very active
  { maxDays: Infinity, multiplier: 1.9 }, // extremely active
]);

export function activityMultiplierForDays(weeklyActiveDays) {
  return ACTIVITY_TIERS.find((tier) => weeklyActiveDays <= tier.maxDays).multiplier;
}

export function calculateTdee(bmr, weeklyActiveDays) {
  if (bmr == null) return null;
  return bmr * activityMultiplierForDays(weeklyActiveDays);
}

/** A ±marginPercent range around the TDEE estimate, rounded to the
 *  nearest 10 kcal — never a false-precise single number. Confidence is
 *  always 'low': a formula-and-activity-bucket estimate is never more
 *  than that without a real metabolic measurement this app has no way
 *  to take. */
export function tdeeConfidenceBand(tdee, marginPercent = 0.12) {
  if (tdee == null) return null;
  const margin = tdee * marginPercent;
  const round10 = (n) => Math.round(n / 10) * 10;
  return {
    low: round10(tdee - margin),
    central: round10(tdee),
    high: round10(tdee + margin),
    confidence: 'low',
  };
}

/** Calorie adjustment from TDEE per category — a deficit for fat loss, a
 *  surplus for hypertrophy, a smaller deficit for recomposition,
 *  maintenance for the rest. Deliberately modest adjustments (never a
 *  crash-diet-sized deficit or an excessive surplus). */
const CATEGORY_CALORIE_ADJUSTMENT = Object.freeze({
  'sedentary-start': 0,
  'cut-fat-loss': -500,
  recomposition: -250,
  'rehab-recuperation': 0,
  hypertrophy: 250,
  endurance: 0,
});

export function calorieTargetForCategory(tdee, category) {
  if (tdee == null) return null;
  const adjustment = CATEGORY_CALORIE_ADJUSTMENT[category] ?? 0;
  return Math.round((tdee + adjustment) / 10) * 10;
}
