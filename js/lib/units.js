// Metric <-> imperial conversions. Kept precise (no rounding) — rounding
// for display is a UI concern, not a math one, so it doesn't compound
// error across a round-trip.

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg) {
  return kg / KG_PER_LB;
}

export function lbToKg(lb) {
  return lb * KG_PER_LB;
}

export function cmToIn(cm) {
  return cm / CM_PER_IN;
}

export function inToCm(inches) {
  return inches * CM_PER_IN;
}

/** Splits a height in cm into whole feet + remaining inches, for display
 *  in a feet'inches" field. */
export function cmToFeetInches(cm) {
  const totalInches = cmToIn(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return { feet, inches };
}

export function feetInchesToCm(feet, inches) {
  return inToCm(feet * 12 + inches);
}
