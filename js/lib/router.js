// A minimal screen router: every top-level screen is a
// <section class="screen" id="screen-*"> in index.html, shown/hidden via
// the `hidden` attribute (never inline style — see base.css's
// `.screen[hidden]{display:none}`). No hash routing / history entries —
// this is a single-page app shell, the same pattern as this publisher's
// sibling apps.

let screens = new Map();
let currentId = null;
const showListeners = new Map(); // screenId -> Set<callback>
const hideListeners = new Map(); // screenId -> Set<callback>
const anyChangeListeners = new Set(); // callback(newId) — fires on every real navigation

export function initRouter(root = document) {
  screens = new Map(
    Array.from(root.querySelectorAll('.screen')).map((el) => [el.id, el])
  );
  currentId = Array.from(screens.values()).find((el) => !el.hidden)?.id ?? null;
}

/** Runs `callback` every time `id` becomes the visible screen — for a
 *  tile/subtitle whose real data depends on another feature entirely (no
 *  single "save" action to hook, unlike e.g. Vitals updating its own tile
 *  from its own save handler), so it needs to know when the Hub itself is
 *  shown again, not just when it's first loaded. */
export function onScreenShown(id, callback) {
  if (!showListeners.has(id)) showListeners.set(id, new Set());
  showListeners.get(id).add(callback);
}

/** The mirror of onScreenShown — runs `callback` the moment `id` stops
 *  being the visible screen. For a screen that stays mounted in the
 *  background (every top-level screen here does, via the `hidden`
 *  attribute, never removed from the DOM), this is where to tear down
 *  anything that shouldn't linger off-screen — e.g. the Hub's own mini
 *  trend-chart (hub-stats-view.ts), whose real DOM nodes would otherwise
 *  still exist, hidden, while some other screen is showing its own
 *  same-shaped chart, silently doubling up any unscoped query for it. */
export function onScreenHidden(id, callback) {
  if (!hideListeners.has(id)) hideListeners.set(id, new Set());
  hideListeners.get(id).add(callback);
}

/** Runs `callback(id)` on every real navigation, regardless of which
 *  screen it's to or from — for chrome that spans every screen instead
 *  of belonging to just one (the bottom nav's own active-tab highlight
 *  and show/hide, js/features/hub/bottom-nav.ts), which would otherwise
 *  need a callback registered against all ~37 screen ids individually.
 *  Never fires for the very first screen shown at app boot (nothing
 *  "changed" yet) — callers that need the initial state read
 *  getCurrentScreenId() once themselves after registering. */
export function onAnyScreenChange(callback) {
  anyChangeListeners.add(callback);
}

export function showScreen(id, { focus = true } = {}) {
  if (!screens.has(id)) {
    throw new Error(`showScreen: no screen registered with id "${id}"`);
  }
  const previousId = currentId;
  for (const [screenId, el] of screens) {
    el.hidden = screenId !== id;
  }
  currentId = id;
  if (previousId && previousId !== id) {
    for (const callback of hideListeners.get(previousId) ?? []) callback();
  }
  for (const callback of showListeners.get(id) ?? []) callback();
  for (const callback of anyChangeListeners) callback(id);
  if (focus) {
    // Move focus + scroll to the top of the new screen for keyboard/screen
    // reader users — a wizard that silently swaps content out from under
    // focus is disorienting.
    const el = screens.get(id);
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: false });
  }
}

export function getCurrentScreenId() {
  return currentId;
}
