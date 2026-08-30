// Fetches and caches a demo SVG's markup so it can be injected inline
// (rather than referenced via <img>) — inline is what lets the SVG's
// stroke="currentColor" pick up the surrounding text color and stay
// correct across light/dark themes.

const cache = new Map();

export async function loadInlineSvg(path) {
  if (cache.has(path)) return cache.get(path);

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load SVG at ${path}: ${response.status}`);
  }
  const markup = await response.text();
  cache.set(path, markup);
  return markup;
}
