// Estimated one-rep max from a logged set — the Epley formula, the most
// common estimate used for this. Like every estimate in this app, it's
// most reliable in the ~1-10 rep range and gets shakier the higher the
// rep count climbs; it's still always an estimate, never treated as a
// measured max (the only way to actually measure a 1RM is to attempt one).

export function estimateOneRepMax(weightKg, reps) {
  if (!(weightKg > 0) || !(reps >= 1) || !Number.isInteger(reps)) return null;
  if (reps === 1) return weightKg; // a single rep at this weight *is* the max, not an estimate of it
  return weightKg * (1 + reps / 30);
}

/** The highest estimated 1RM across a list of {weightKg, reps} sets —
 *  e.g. every logged set for one exercise. null for an empty/all-invalid list. */
export function bestEstimatedOneRepMax(sets) {
  let best = null;
  for (const set of sets) {
    const estimate = estimateOneRepMax(set.weightKg, set.reps);
    if (estimate != null && (best == null || estimate > best)) best = estimate;
  }
  return best;
}
