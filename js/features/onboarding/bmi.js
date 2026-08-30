// BMI is a coarse, imperfect signal — it doesn't distinguish muscle from
// fat and isn't a diagnosis. Used here only as one quiet input into the
// category engine's reasoning, never surfaced to the person as a clinical
// verdict. See classifyBmi()'s labels: neutral, not judgmental.

export function calculateBmi(heightCm, weightKg) {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

const THRESHOLDS = Object.freeze({
  BELOW_TYPICAL: 18.5,
  TYPICAL: 25,
  ABOVE_TYPICAL: 30,
});

/** WHO-standard cutoffs, deliberately relabeled away from clinical terms
 *  like "underweight"/"obese" — this is an internal signal, not something
 *  shown to the person as a label for their body. */
export function classifyBmi(bmi) {
  if (bmi == null || Number.isNaN(bmi)) return null;
  if (bmi < THRESHOLDS.BELOW_TYPICAL) return 'below-typical';
  if (bmi < THRESHOLDS.TYPICAL) return 'typical';
  if (bmi < THRESHOLDS.ABOVE_TYPICAL) return 'above-typical';
  return 'well-above-typical';
}
