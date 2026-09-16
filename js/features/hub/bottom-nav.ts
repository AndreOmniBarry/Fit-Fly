// The app-wide bottom nav — real chrome shared across the app's 4 real
// top-level destinations (Hub, Fitness Toolkit, Badges, Settings), never
// shown on a deep mini-app screen (Sleep dashboard, Steps, ...), each of
// which already has its own real back button; this was never meant to be
// a second way to leave one. Lives under features/hub since the Hub is
// the app's own front door and this bar is really an extension of it,
// but it reacts to navigation app-wide via router.js's onAnyScreenChange
// rather than anything Hub-specific.
import { showScreen, onAnyScreenChange, getCurrentScreenId } from '../../lib/router.js';

const TOP_LEVEL_SCREENS = ['screen-hub', 'screen-home', 'screen-badges', 'screen-settings'] as const;
type TopLevelScreen = (typeof TOP_LEVEL_SCREENS)[number];

function isTopLevelScreen(id: string | null): id is TopLevelScreen {
  return (TOP_LEVEL_SCREENS as readonly string[]).includes(id ?? '');
}

// .bottom-nav's own real content height (6px + 6px vertical padding, a
// 22px icon, a 2px gap, one ~13px label line) — kept in sync with
// components.css by hand since CSS can't hand a number back to JS.
const BOTTOM_NAV_CONTENT_HEIGHT_PX = 56;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`bottom-nav: missing #${id}`);
  return el as T;
}

export function initBottomNav(): void {
  const nav = byId<HTMLElement>('bottom-nav');
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('.bottom-nav-btn'));

  for (const btn of buttons) {
    const target = btn.dataset.navScreen;
    if (!target) continue;
    btn.addEventListener('click', () => showScreen(target));
  }

  // The floating stopwatch/voice-mic buttons (index.html) read this same
  // variable in their own inline `bottom:` calc — real coordination
  // instead of two separately-hardcoded fixed positions that would
  // collide the moment both this nav and one of them are visible at once.
  // A fixed constant (matching .bottom-nav's own real content height in
  // components.css, safe-area excluded — each floating element already
  // adds its own env(safe-area-inset-bottom) term) rather than measuring
  // nav.offsetHeight, which would read 0 while [hidden] (display:none).
  function setNavHeightVar(visible: boolean): void {
    document.documentElement.style.setProperty('--bottom-nav-h', visible ? `${BOTTOM_NAV_CONTENT_HEIGHT_PX}px` : '0px');
  }

  function update(id: string | null): void {
    const show = isTopLevelScreen(id);
    nav.hidden = !show;
    setNavHeightVar(show);
    for (const btn of buttons) {
      const active = show && btn.dataset.navScreen === id;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  }

  onAnyScreenChange(update);
  update(getCurrentScreenId());
}
