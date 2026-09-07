// Real per-day distance totals from logged runs — several runs on the
// same day add up to one real daily total, the same "group before
// bucketing" principle as Hydration's own groupHydrationByDate (see
// js/features/hydration/hydration-trend.ts), so a D/W/M/6M/Y trend can
// bucket real calendar days instead of a fixed "last 8 runs" window.

/** The UTC calendar day a run's ISO startedAt falls on — the same
 *  slicing convention Vitals' own date-only readouts already use for
 *  their own ISO-timestamped samples. */
function dateOnly(startedAt) {
  return startedAt.slice(0, 10);
}

/** @param {{startedAt:string, distanceMeters:number}[]} runs
 *  @returns {Map<string, number>} date -> summed distanceMeters that day
 */
export function groupRunsByDate(runs) {
  const totals = new Map();
  for (const run of runs) {
    const date = dateOnly(run.startedAt);
    totals.set(date, (totals.get(date) ?? 0) + run.distanceMeters);
  }
  return totals;
}
