// PR detection. A "fastest pace" PR only counts runs past a minimum
// distance — otherwise a 50-meter sprint would always beat every real
// run on pace and the PR would be meaningless.

const MIN_DISTANCE_FOR_PACE_PR_METERS = 1000;

export function longestRun(runs) {
  if (runs.length === 0) return null;
  return runs.reduce((best, run) => (run.distanceMeters > best.distanceMeters ? run : best));
}

export function fastestPaceRun(runs) {
  const eligible = runs.filter((r) => r.distanceMeters >= MIN_DISTANCE_FOR_PACE_PR_METERS && r.avgPaceSecPerKm != null);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, run) => (run.avgPaceSecPerKm < best.avgPaceSecPerKm ? run : best));
}

/**
 * Checks whether `newRun` beats every *prior* run (priorRuns should not
 * include newRun itself) on distance and/or pace.
 * @returns {{isDistancePR: boolean, isPacePR: boolean}}
 */
export function detectNewPRs(newRun, priorRuns) {
  const priorLongest = longestRun(priorRuns);
  const isDistancePR = !priorLongest || newRun.distanceMeters > priorLongest.distanceMeters;

  let isPacePR = false;
  if (newRun.distanceMeters >= MIN_DISTANCE_FOR_PACE_PR_METERS && newRun.avgPaceSecPerKm != null) {
    const priorFastest = fastestPaceRun(priorRuns);
    isPacePR = !priorFastest || newRun.avgPaceSecPerKm < priorFastest.avgPaceSecPerKm;
  }

  return { isDistancePR, isPacePR };
}
