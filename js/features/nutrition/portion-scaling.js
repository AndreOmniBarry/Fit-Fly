// A "per 100g" figure (from Open Food Facts search or the regional
// staple reference list — see regional-staples.js) is not the number of
// calories anyone actually ate; it's a unit price. The old Quick Add
// flow filled the form with the raw per-100g figures and left turning
// that into a real portion entirely to the user's mental math, with
// only a text hint saying "adjust these yourself." That's the exact
// kind of quiet, low-effort gap this rebuild is meant to close: the
// arithmetic is trivial and this app should just do it.
//
// scalePortion() is the one place that arithmetic happens — pure,
// DOM-free, unit-tested, same convention as bmr-tdee.js and
// macro-targets.js. The UI (nutrition-view.js) calls this whenever the
// "grams eaten" field changes, using whichever per-100g figure the user
// most recently picked (an Open Food Facts result or a regional staple)
// as the base.

export const DEFAULT_PORTION_GRAMS = 100;

/**
 * @param {{caloriesPer100g:number, proteinGPer100g:number, carbsGPer100g:number,
 *   fatGPer100g:number, fiberGPer100g?:number}} per100g
 * @param {number} gramsEaten
 * @returns {{calories:number, proteinG:number, carbsG:number, fatG:number, fiberG:number}|null}
 *   null for a non-positive/missing gram amount — never a divide-by-zero
 *   or a silently-wrong scaled figure.
 */
export function scalePortion(per100g, gramsEaten) {
  if (!per100g || !(gramsEaten > 0)) return null;

  const factor = gramsEaten / 100;
  const scale = (perHundred) => Math.round((perHundred ?? 0) * factor);

  return {
    calories: scale(per100g.caloriesPer100g),
    proteinG: scale(per100g.proteinGPer100g),
    carbsG: scale(per100g.carbsGPer100g),
    fatG: scale(per100g.fatGPer100g),
    fiberG: scale(per100g.fiberGPer100g),
  };
}
