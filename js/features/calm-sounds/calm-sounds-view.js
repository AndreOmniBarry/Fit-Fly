// Calm Sounds' own screen: browse the catalog, start/stop real playback,
// pick a stop timer, control volume. Wind Down's ambient-sound picker
// (js/features/sleep/sleep-view.ts) drives the exact same shared engine —
// see audio-engine.ts's getCalmAudioEngine().
import { showScreen } from '../../lib/router.js';
import { getCalmAudioEngine } from './audio-engine.js';
import { SOUNDSCAPES } from './soundscapes.js';
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`calm-sounds-view: missing #${id}`);
    return el;
}
function formatRemaining(ms) {
    if (ms == null)
        return '';
    const minutes = Math.max(0, Math.ceil(ms / 60_000));
    return minutes <= 1 ? '<1 min left' : `${minutes} min left`;
}
export function initCalmSoundsFeature() {
    const engine = getCalmAudioEngine();
    const grid = byId('calm-sound-grid');
    const tileButtons = new Map();
    for (const soundscape of SOUNDSCAPES) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'calm-sound-tile';
        tile.id = `calm-sound-${soundscape.id}`;
        tile.setAttribute('aria-pressed', 'false');
        tile.innerHTML = `<span aria-hidden="true" style="font-size:20px;">${soundscape.icon}</span><span class="name">${soundscape.name}</span>`;
        tile.addEventListener('click', () => {
            const state = engine.getState();
            if (state.playing && state.soundscapeId === soundscape.id) {
                engine.stop();
            }
            else {
                void engine.start(soundscape.id);
            }
        });
        grid.append(tile);
        tileButtons.set(soundscape.id, tile);
    }
    function render(state) {
        for (const [id, tile] of tileButtons) {
            tile.setAttribute('aria-pressed', String(state.playing && state.soundscapeId === id));
        }
        const nowPlaying = byId('calm-now-playing');
        nowPlaying.hidden = !state.playing;
        if (state.playing && state.soundscapeId) {
            const soundscape = SOUNDSCAPES.find((s) => s.id === state.soundscapeId);
            byId('calm-now-playing-name').textContent = soundscape?.name ?? '—';
            const remaining = formatRemaining(state.remainingMs);
            byId('calm-now-playing-status').textContent = remaining ? `Playing · ${remaining}` : 'Playing';
        }
        byId('calm-unsupported').hidden = state.supported;
        // Wind Down can change the timer/volume too — keep this screen's
        // controls in sync with whatever the shared engine actually holds,
        // not just with clicks made here.
        const volumeInput = byId('calm-volume');
        const volumePercent = String(Math.round(state.volume * 100));
        if (document.activeElement !== volumeInput)
            volumeInput.value = volumePercent;
        for (const pill of timerRow.querySelectorAll('.calm-timer-pill')) {
            const pillValue = pill.dataset.value === 'none' ? null : Number(pill.dataset.value);
            pill.setAttribute('aria-pressed', String(pillValue === state.timerMinutes));
        }
    }
    const timerRow = byId('calm-timer-row');
    engine.onStateChange(render);
    engine.setTimer(30); // matches the markup's pre-selected "30m" pill
    render(engine.getState());
    byId('btn-calm-stop').addEventListener('click', () => engine.stop());
    byId('calm-volume').addEventListener('input', (event) => {
        const value = Number(event.target.value);
        engine.setVolume(value / 100);
    });
    timerRow.addEventListener('click', (event) => {
        const button = event.target.closest('.calm-timer-pill');
        if (!button || !timerRow.contains(button))
            return;
        const value = button.dataset.value;
        engine.setTimer(value === 'none' ? null : Number(value));
    });
    byId('btn-calm-sounds-back').addEventListener('click', () => showScreen('screen-hub'));
}
//# sourceMappingURL=calm-sounds-view.js.map