// Focus's own screen: browse the catalog, start/stop real playback,
// pick a stop timer, control volume, and launch a guided session
// (guided-session-view.ts). Wind Down's ambient-sound picker
// (js/features/sleep/sleep-view.ts) drives the exact same shared engine —
// see audio-engine.ts's getFocusAudioEngine().
import { showScreen } from '../../lib/router.js';
import { iconMarkup } from '../../lib/icons.js';
import { getFocusAudioEngine } from './audio-engine.js';
import { SOUNDSCAPES } from './soundscapes.js';
import type { FocusAudioState } from './audio-engine.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`focus-view: missing #${id}`);
  return el as T;
}

function formatRemaining(ms: number | null): string {
  if (ms == null) return '';
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return minutes <= 1 ? '<1 min left' : `${minutes} min left`;
}

export function initFocusFeature(): void {
  const engine = getFocusAudioEngine();
  const grid = byId('focus-sound-grid');
  const tileButtons = new Map<string, HTMLButtonElement>();

  for (const soundscape of SOUNDSCAPES) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'focus-sound-tile';
    tile.id = `focus-sound-${soundscape.id}`;
    tile.setAttribute('aria-pressed', 'false');
    tile.innerHTML = `${iconMarkup(soundscape.icon, { size: 20 })}<span class="name">${soundscape.name}</span>`;
    tile.addEventListener('click', () => {
      const state = engine.getState();
      if (state.playing && state.soundscapeId === soundscape.id) {
        engine.stop();
      } else {
        void engine.start(soundscape.id);
      }
    });
    grid.append(tile);
    tileButtons.set(soundscape.id, tile);
  }

  function render(state: FocusAudioState): void {
    for (const [id, tile] of tileButtons) {
      tile.setAttribute('aria-pressed', String(state.playing && state.soundscapeId === id));
    }

    const nowPlaying = byId('focus-now-playing');
    nowPlaying.hidden = !state.playing;
    if (state.playing && state.soundscapeId) {
      const soundscape = SOUNDSCAPES.find((s) => s.id === state.soundscapeId);
      byId('focus-now-playing-name').textContent = soundscape?.name ?? '—';
      const remaining = formatRemaining(state.remainingMs);
      byId('focus-now-playing-status').textContent = remaining ? `Playing · ${remaining}` : 'Playing';
    }

    byId('focus-unsupported').hidden = state.supported;

    // Wind Down can change the timer/volume too — keep this screen's
    // controls in sync with whatever the shared engine actually holds,
    // not just with clicks made here.
    const volumeInput = byId<HTMLInputElement>('focus-volume');
    const volumePercent = String(Math.round(state.volume * 100));
    if (document.activeElement !== volumeInput) volumeInput.value = volumePercent;

    for (const pill of timerRow.querySelectorAll<HTMLButtonElement>('.focus-timer-pill')) {
      const pillValue = pill.dataset.value === 'none' ? null : Number(pill.dataset.value);
      pill.setAttribute('aria-pressed', String(pillValue === state.timerMinutes));
    }
  }

  const timerRow = byId('focus-timer-row');

  engine.onStateChange(render);
  engine.setTimer(30); // matches the markup's pre-selected "30m" pill
  render(engine.getState());

  byId('btn-focus-stop').addEventListener('click', () => engine.stop());

  byId<HTMLInputElement>('focus-volume').addEventListener('input', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    engine.setVolume(value / 100);
  });

  timerRow.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.focus-timer-pill');
    if (!button || !timerRow.contains(button)) return;
    const value = button.dataset.value;
    engine.setTimer(value === 'none' ? null : Number(value));
  });

  byId('btn-focus-back').addEventListener('click', () => showScreen('screen-hub'));
}
