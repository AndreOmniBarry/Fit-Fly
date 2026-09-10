// Classifies a goal into a real activity type — used only to pick a
// fitting phrase for notifications and milestone copy, never to change
// any math. Goals stay freeform underneath (goalType is an optional
// field, see goal-types.js/js/db/repositories/goals.js — nothing
// requires it), so this still falls back to reading the same name/unit
// words a person typed for anyone who skipped picking a type or created
// their goal before this existed. An ambiguous or unrecognized goal
// falls back to 'generic' — a wrong catchy phrase is worse than a plain
// one.

/** Order matters: checked top to bottom, first match wins. Distance units
 *  like "km"/"mi" are deliberately below both walk and run — "Walk 5km"
 *  should read as a walk, not a run, so the more specific word wins over
 *  the more generic unit. */
const ACTIVITY_RULES = [
  { type: 'hydration', pattern: /\bwater\b|hydrat|\bliters?\b|\blitres?\b|\bml\b|\boz\b|glasses? of water/i },
  { type: 'sleep', pattern: /\bsleep\b|bedtime|hours? of sleep/i },
  { type: 'walk', pattern: /\bwalk(ing|s)?\b|\bsteps?\b/i },
  { type: 'strength', pattern: /\bbench\b|\bsquat\b|\bdeadlift\b|\blift(ing)?\b|\brep(s)?\b|\bpr\b|1rm/i },
  { type: 'run', pattern: /\brun(ning|s)?\b|\bjog(ging)?\b|\bmarathon\b|\b5k\b|\b10k\b|\brace\b|\bkm\b|\bmiles?\b|\bmi\b/i },
  { type: 'weight', pattern: /\bweight\b|body ?fat|\bkg\b|\blbs?\b/i },
];

// A goal created with an explicit type (goal-types.js's picker) maps
// directly, real and unambiguous — no need to guess "kg" between a
// Strength goal and a Body Composition one when the person already said
// which it was. 'custom' isn't listed here on purpose: it means "no real
// type", so it falls through to the same regex inference as always.
const EXPLICIT_TYPE_MAP = Object.freeze({
  cardio: 'cardio',
  strength: 'strength',
  skill: 'skill',
  body: 'weight',
});

/**
 * @param {{name?: string, unit?: string, goalType?: string}} goal
 * @returns {'hydration'|'sleep'|'walk'|'strength'|'run'|'weight'|'cardio'|'skill'|'generic'}
 */
export function inferActivityType(goal) {
  const explicit = EXPLICIT_TYPE_MAP[goal?.goalType];
  if (explicit) return explicit;

  const haystack = `${goal?.name ?? ''} ${goal?.unit ?? ''}`;
  const rule = ACTIVITY_RULES.find(({ pattern }) => pattern.test(haystack));
  return rule?.type ?? 'generic';
}
