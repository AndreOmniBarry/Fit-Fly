// Real food search against Open Food Facts — a free, open (ODbL-licensed)
// food database, no API key, no account, no paid service (openfoodfacts.org).
// This is the one place in this app that talks to a server at all; see the
// README's "Your data stays on this device" section for exactly what that
// does and doesn't mean (the search text goes to Open Food Facts to look
// up nutrition facts — nothing about what's actually logged does).
//
// Deliberately NOT wired to fire on every keystroke: Open Food Facts asks
// that /search not be used for search-as-you-type and caps it around
// 10 requests/minute/IP, so this is only ever called from an explicit
// action (a Search button / pressing Enter), never a keyup handler.
//
// Search results carry Open Food Facts' own per-100g nutrition figures —
// real data, but for 100g of that product, not for whatever portion
// someone actually ate. This module doesn't try to guess a serving size;
// it returns the per-100g numbers labeled as such and lets the caller
// (nutrition-view.js) make that explicit before anything gets logged,
// same honesty rule as every other estimate in this app.

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PAGE_SIZE = 12;

/**
 * @param {string} query
 * @param {{fetchImpl?: typeof fetch}} [options] - fetchImpl is injectable
 *   for tests; defaults to the real global fetch.
 * @returns {Promise<{name:string, caloriesPer100g:number, proteinGPer100g:number,
 *   carbsGPer100g:number, fatGPer100g:number, fiberGPer100g:number}[]>}
 * @throws {Error} on a network failure or a non-OK response — the caller
 *   is responsible for showing that honestly (e.g. "couldn't reach the
 *   food database — check your connection"), never silently swallowing it
 *   into an empty result that reads as "no matches".
 */
export async function searchFoods(query, { fetchImpl = globalThis.fetch } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!fetchImpl) throw new Error('Food search needs a browser with fetch support.');

  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(trimmed)}&search_simple=1&action=process&json=1&page_size=${PAGE_SIZE}&fields=product_name,nutriments`; // nutriments carries fiber_100g too — see normalizeProduct
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Food search failed (${response.status})`);

  const data = await response.json();
  return (data.products ?? []).map(normalizeProduct).filter((product) => product != null);
}

function normalizeProduct(product) {
  const name = product?.product_name?.trim();
  const nutriments = product?.nutriments ?? {};
  const caloriesPer100g = nutriments['energy-kcal_100g'];
  // No name or no usable calorie figure — Open Food Facts has plenty of
  // incomplete entries (crowdsourced data). Skip it rather than show a
  // result with a blank or fabricated number.
  if (!name || !(caloriesPer100g > 0)) return null;

  return {
    name,
    caloriesPer100g: Math.round(caloriesPer100g),
    proteinGPer100g: Math.round(nutriments.proteins_100g ?? 0),
    carbsGPer100g: Math.round(nutriments.carbohydrates_100g ?? 0),
    fatGPer100g: Math.round(nutriments.fat_100g ?? 0),
    fiberGPer100g: Math.round(nutriments.fiber_100g ?? 0),
  };
}
