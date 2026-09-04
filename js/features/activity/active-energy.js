// Active Energy: Apple Health's own "Move" concept — every real calorie
// estimate this app already computes (Steps, Run, Activity logging,
// Strength sessions), rolled into one daily total. Every one of those
// estimates already existed on its own screen; this is the first place
// they're added together rather than staying four separate numbers.

/** @param {(number|null)[]} kcalEstimates - one per source, null where
 *  that source had nothing to estimate from today.
 *  @returns {number|null} the real sum, or null only when every source
 *  is null (nothing to show at all — never a fabricated 0). */
export function sumActiveEnergy(kcalEstimates) {
  const known = kcalEstimates.filter((kcal) => kcal != null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, kcal) => sum + kcal, 0));
}

/** True if the ISO timestamp falls on the same local calendar day as
 *  `today` — the basis for "today's" Active Energy, same local-day
 *  comparison every other "today" readout in this app already makes. */
export function isSameLocalDay(isoTimestamp, today = new Date()) {
  const d = new Date(isoTimestamp);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}
