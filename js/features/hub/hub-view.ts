// The Hub: the app's front door. It only wires navigation between the
// mini-app tiles and the screens they open — every mini-app owns its own
// feature module (sleep-view.ts, focus-view.ts, ...) the same way
// every pre-existing feature owns its own screen(s). Nothing here reaches
// into another mini-app's internals.
import { showScreen } from '../../lib/router.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`hub-view: missing #${id}`);
  return el as T;
}

export function initHubFeature(): void {
  byId('btn-home-fitness-toolkit').addEventListener('click', () => showScreen('screen-home'));
  byId('btn-fitness-toolkit-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-sleep').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
  byId('btn-sleep-dashboard-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-focus').addEventListener('click', () => showScreen('screen-focus'));
  byId('btn-focus-back').addEventListener('click', () => showScreen('screen-hub'));
}

/** Updates the Sleep tile's subtitle on the Hub — e.g. "86 · Great last
 * night" once a score exists, left at its default "Log tonight's sleep"
 * until then. Exported so sleep-view.ts can call it after saving a night's
 * log, without the Hub needing to know anything about how Sleep computes
 * that text. */
export function setSleepTileSubtitle(text: string): void {
  byId('hub-sleep-sub').textContent = text;
}
