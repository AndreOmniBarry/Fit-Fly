// A minimal screen router: every top-level screen is a
// <section class="screen" id="screen-*"> in index.html, shown/hidden via
// the `hidden` attribute (never inline style — see base.css's
// `.screen[hidden]{display:none}`). No hash routing / history entries —
// this is a single-page app shell, the same pattern as this publisher's
// sibling apps.

let screens = new Map();
let currentId = null;

export function initRouter(root = document) {
  screens = new Map(
    Array.from(root.querySelectorAll('.screen')).map((el) => [el.id, el])
  );
  currentId = Array.from(screens.values()).find((el) => !el.hidden)?.id ?? null;
}

export function showScreen(id, { focus = true } = {}) {
  if (!screens.has(id)) {
    throw new Error(`showScreen: no screen registered with id "${id}"`);
  }
  for (const [screenId, el] of screens) {
    el.hidden = screenId !== id;
  }
  currentId = id;
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
