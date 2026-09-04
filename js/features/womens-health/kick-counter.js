// Fetal movement ("kick") counting — a real, standard third-trimester
// monitoring practice (ACOG/NHS patient guidance): count real felt
// movements until reaching a target count, noting how long it took.
// Commonly well under two hours; a real, unusually long session is
// exactly the kind of change worth mentioning to a real care provider —
// this app counts and shows the real elapsed time, it never diagnoses.

export const DEFAULT_KICK_TARGET = 10;

/**
 * @param {number[]} tapTimestampsMs - real Date.now() values, one per
 *   recorded kick, in the order they were tapped.
 * @returns {{count:number, durationMs:number|null, reachedTarget:boolean}}
 *   durationMs is null with fewer than 2 taps — no real elapsed span
 *   from a single kick — never a fabricated 0.
 */
export function summarizeKickSession(tapTimestampsMs, target = DEFAULT_KICK_TARGET) {
  const count = tapTimestampsMs.length;
  const durationMs = count >= 2 ? tapTimestampsMs[count - 1] - tapTimestampsMs[0] : null;
  return { count, durationMs, reachedTarget: count >= target };
}
