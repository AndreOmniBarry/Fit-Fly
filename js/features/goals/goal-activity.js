// Classifies a goal into a real activity type from what the person
// actually typed when they created it (name + unit) — used only to pick
// a fitting phrase for notifications and milestone copy, never to change
// any math. Goals here are freeform (there's no fixed "goal type" field
// in the data model, see js/db/repositories/goals.js), so this reads the
// same words a person already chose rather than inventing a category
// they never gave. An ambiguous or unrecognized goal falls back to
// 'generic' — a wrong catchy phrase is worse than a plain one.

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

/**
 * @param {{name?: string, unit?: string}} goal
 * @returns {'hydration'|'sleep'|'walk'|'strength'|'run'|'weight'|'generic'}
 */
export function inferActivityType(goal) {
  const haystack = `${goal?.name ?? ''} ${goal?.unit ?? ''}`;
  const rule = ACTIVITY_RULES.find(({ pattern }) => pattern.test(haystack));
  return rule?.type ?? 'generic';
}
