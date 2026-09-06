// Picks how long to rest after a set, from what the set actually *was* —
// not one fixed number for every exercise in a program. This is the
// whole reason an in-workout rest timer earns its place over just using
// your phone's stock timer: your phone doesn't know you just did 5 reps
// of a heavy compound lift versus 15 reps of a core hold, so it can't
// pick a duration for you. This can, because Programs already knows the
// exercise's movement pattern, how it's loaded, and the rep range it was
// just prescribed at.
//
// The rest-interval ranges below follow the general strength-and-
// conditioning consensus (ACSM's Guidelines for Exercise Testing and
// Prescription; NSCA's Essentials of Strength Training and
// Conditioning) plus later meta-analytic work specifically on rest and
// hypertrophy/strength (Grgic et al., 2018, "Effects of Rest Interval
// Duration in Resistance Training on Measures of Muscular Strength: A
// Systematic Review", Sports Medicine):
//   - Short (~60-90s) rest is sufficient for isolation work and
//     higher-rep (12+), metabolically-driven sets, where the limiting
//     factor clears quickly and isn't neuromuscular in nature.
//   - Long (~2-3min) rest meaningfully improves output on low-rep
//     (<=6), near-maximal, multi-joint ("compound") lifts under real
//     external load — full ATP-CP and CNS recovery measurably matters
//     there in a way it doesn't for lighter, higher-rep accessory work.
// Everything else (moderate 7-12 rep hypertrophy-range work) sits in
// between, nudged up when the set was both compound *and* externally
// loaded (a dumbbell lift recruits meaningfully more total muscle mass,
// and taxes the CNS harder, than the same rep range done bodyweight).

export type MovementPattern = 'squat' | 'hinge' | 'push' | 'pull' | 'core' | 'cardio';
export type LogMetric = 'reps-weight' | 'reps' | 'time';

export interface RestDurationInput {
  /** The exercise's own movement pattern (exercise-library.js). */
  pattern: MovementPattern;
  /** What the set was actually logged as. */
  logMetric: LogMetric;
  /** The prescribed rep range for this set, e.g. "8-12" or "3-6" — same
   *  shape program-generator.js already prescribes. Ignored (and not
   *  required) for logMetric 'time', which has no rep count at all. */
  reps?: string;
}

/** Multi-joint patterns that recruit multiple muscle groups at once —
 *  the "compound lift" half of the isolation/compound split this whole
 *  module is built around. 'core' and 'cardio' are the isolation/
 *  metabolic-conditioning half. */
const COMPOUND_PATTERNS: ReadonlySet<MovementPattern> = new Set(['squat', 'hinge', 'push', 'pull']);

const DEFAULT_REPS_MIDPOINT = 10; // a plain, moderate hypertrophy-range guess if reps is missing/malformed

/** The midpoint of a "low-high" rep-range string (program-generator.js's
 *  own prescription shape). Never throws on something malformed or
 *  missing — a bad/absent prescription still needs *a* real, reasonable
 *  duration out of this, not a crash. */
export function parseRepsMidpoint(reps: string | undefined): number {
  if (!reps) return DEFAULT_REPS_MIDPOINT;
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(reps.trim());
  if (match) {
    const low = Number(match[1]);
    const high = Number(match[2]);
    return (low + high) / 2;
  }
  const single = Number(reps);
  return Number.isFinite(single) && single > 0 ? single : DEFAULT_REPS_MIDPOINT;
}

/** Seconds to rest after a just-logged set of this exercise. Pure and
 *  fully deterministic — same exercise metadata always gives the same
 *  answer — so it's cheaply unit-testable and safe to call straight from
 *  the moment a set is logged, no lookup table or DB round trip needed. */
export function selectRestSeconds(input: RestDurationInput): number {
  // A timed hold/cardio bout has no rep count to reason about at all —
  // these are short, active-recovery-style breaks, not a strength set's
  // full recovery window. Cardio's own pattern (e.g. a standing-march
  // bout) gets the shortest break of anything here: the intent there is
  // sustained-effort conditioning, not maximal output on the next set.
  if (input.logMetric === 'time') {
    return input.pattern === 'cardio' ? 30 : 45;
  }

  const repsMid = parseRepsMidpoint(input.reps);
  const isCompound = COMPOUND_PATTERNS.has(input.pattern);
  const isLoaded = input.logMetric === 'reps-weight';

  let restSec: number;
  if (repsMid <= 6) {
    restSec = 150; // near-maximal effort, whatever the pattern
  } else if (repsMid <= 12) {
    restSec = 90; // the standard hypertrophy-range rep count
  } else {
    restSec = 60; // high-rep, endurance/metabolic-conditioning work
  }

  // A compound movement under real external load taxes the CNS and
  // recruits far more total muscle mass than the same rep range done as
  // an isolation move or bodyweight-only — evidence-based territory for
  // pushing rest up toward the full 2-3min heavy-compound range.
  if (isCompound && isLoaded) restSec += 30;

  return restSec;
}
