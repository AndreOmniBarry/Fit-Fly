// Theme + category-accent application. Pure logic (safe to unit-test) is
// kept separate from the DOM-mutating calls below so Vitest can exercise
// the rules without a browser.

export const CATEGORIES = Object.freeze([
  'sedentary-start',
  'cut-fat-loss',
  'recomposition',
  'rehab-recuperation',
  'hypertrophy',
  'endurance',
]);

const CATEGORY_SET = new Set(CATEGORIES);

export function isValidCategory(category) {
  return CATEGORY_SET.has(category);
}

export function isValidThemePreference(preference) {
  return preference === 'light' || preference === 'dark' || preference === 'system';
}

/** Stamps (or clears) data-category on the given root element. */
export function applyCategoryAccent(category, root) {
  if (isValidCategory(category)) {
    root.setAttribute('data-category', category);
  } else {
    root.removeAttribute('data-category');
  }
}

/** Stamps (or clears) data-theme on the given root element. 'system' defers
 *  to the prefers-color-scheme media query already wired into tokens.css. */
export function applyThemePreference(preference, root) {
  if (preference === 'light' || preference === 'dark') {
    root.setAttribute('data-theme', preference);
  } else {
    root.removeAttribute('data-theme');
  }
}
