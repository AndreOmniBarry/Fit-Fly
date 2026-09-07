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

// api/v2/search is Open Food Facts' current, actively-documented REST
// endpoint — cgi/search.pl (the legacy Perl/MongoDB script this used to
// call) is what their own API docs now point integrators away from, and
// a version that talks to it consistently returning "couldn't reach the
// food database" for every single query (not just some) is exactly the
// symptom of a deprecated endpoint that's become unreliable rather than
// a real per-query problem. The v2 endpoint deliberately keeps the same
// query-string shape (search_terms/fields/page_size/json) for backward
// compatibility, so nothing else here needed to change.
const SEARCH_URL = 'https://world.openfoodfacts.org/api/v2/search';
const PAGE_SIZE = 12;
const REQUEST_TIMEOUT_MS = 10000;

/**
 * @param {string} query
 * @param {{fetchImpl?: typeof fetch}} [options] - fetchImpl is injectable
 *   for tests; defaults to the real global fetch.
 * @returns {Promise<{name:string, caloriesPer100g:number, proteinGPer100g:number,
 *   carbsGPer100g:number, fatGPer100g:number, fiberGPer100g:number}[]>}
 * @throws {Error} on a network failure, a timeout, or a non-OK response —
 *   the caller is responsible for showing that honestly (e.g. "couldn't
 *   reach the food database — check your connection"), never silently
 *   swallowing it into an empty result that reads as "no matches".
 */
export async function searchFoods(query, { fetchImpl = globalThis.fetch } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!fetchImpl) throw new Error('Food search needs a browser with fetch support.');

  const url = `${SEARCH_URL}?search_terms=${encodeURIComponent(trimmed)}&search_simple=1&action=process&json=1&page_size=${PAGE_SIZE}&fields=product_name,nutriments`; // nutriments carries fiber_100g too — see normalizeProduct

  // A real, bounded timeout — a request that never resolves at all (a
  // stalled connection, not a clean error) would otherwise leave the
  // search spinner stuck forever instead of an honest, timely failure.
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  let response;
  try {
    response = await fetchImpl(url, controller ? { signal: controller.signal } : undefined);
  } catch (error) {
    if (controller?.signal.aborted) throw new Error('Food search timed out — check your connection.');
    throw error;
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
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
