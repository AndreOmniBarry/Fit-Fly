// Maps an exercise's own metadata (`pattern` + `logMetric`) onto one of a
// small, fixed set of *movement categories* — the key the looping demo
// animation (movement-demo-svg.js) is keyed by. Deliberately not keyed by
// exercise id/name: a per-exercise animation doesn't scale as the
// library grows (see exercise-library.js's own comment), while every
// exercise the library will ever hold already declares a real movement
// pattern it needs a category picker anyway.
//
// Pure and DOM-free by the same convention every other Programs domain-
// logic file in this directory follows (program-generator.js,
// periodization.js, body-area-tag.js, ...) — program-view.js is the only
// place this gets wired into the DOM.

export const MOVEMENT_CATEGORIES = Object.freeze([
  'squat',
  'hinge',
  'push',
  'pull',
  'hold',
  'core',
  'cardio',
  'mobility',
]);

/**
 * @param {object} exercise - a library exercise (or anything shaped like
 *   one) — only `pattern` and `logMetric` are read.
 * @returns {string} one of MOVEMENT_CATEGORIES
 */
export function categorizeExercise({ pattern, logMetric }) {
  // A real stretch/mobility drill always animates as one, regardless of
  // whether it happens to be logged as a hold (most are) — 'mobility'
  // pattern is itself already the specific, deliberate signal.
  if (pattern === 'mobility') return 'mobility';
  if (pattern === 'cardio') return 'cardio';

  // 'core' is the one pattern that covers two genuinely different
  // movements: a static hold (plank — no rep count, sustained tension)
  // and a slow dynamic drill (dead bug — real reps, moving limbs). They
  // deserve visibly different loops, not the same animation regardless
  // of which one it actually is.
  if (pattern === 'core') return logMetric === 'hold' ? 'hold' : 'core';

  // squat / hinge / push / pull all map onto themselves — each is
  // already a distinct, real movement pattern with nothing further to
  // disambiguate.
  return pattern;
}
