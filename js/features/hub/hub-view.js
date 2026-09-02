// The Hub: the app's front door. It wires navigation between the mini-app
// tiles and the screens they open — every mini-app owns its own feature
// module (sleep-view.ts, focus-view.ts, ...) the same way every
// pre-existing feature owns its own screen(s). It also owns the tiles'
// kinetic-data readouts (the Sleep ring, the Focus waveform) and the
// spatial-tilt effect, since both are Hub presentation, not something any
// mini-app should need to know exists.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { getFocusAudioEngine } from '../focus/audio-engine.js';
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`hub-view: missing #${id}`);
    return el;
}
function bySvgId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`hub-view: missing #${id}`);
    return el;
}
// Matches .hub-ring-fill's r=16 in index.html/mini-apps.css.
const HUB_RING_CIRCUMFERENCE = 2 * Math.PI * 16;
export function initHubFeature() {
    byId('btn-home-fitness-toolkit').addEventListener('click', () => showScreen('screen-home'));
    byId('btn-fitness-toolkit-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-sleep').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
    byId('btn-sleep-dashboard-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-focus').addEventListener('click', () => showScreen('screen-focus'));
    byId('btn-focus-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-meditate').addEventListener('click', () => showScreen('screen-meditate'));
    byId('btn-meditate-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-vitals').addEventListener('click', () => showScreen('screen-vitals'));
    byId('btn-vitals-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-steps').addEventListener('click', () => showScreen('screen-steps'));
    byId('btn-steps-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-hydration').addEventListener('click', () => showScreen('screen-hydration'));
    byId('btn-hydration-back').addEventListener('click', () => showScreen('screen-hub'));
    // Spatial tilt: one shared reading (pointer, or real device tilt once
    // granted) drives every tile's depth-layered parallax at once. iOS 13+
    // gates device-tilt behind a user gesture — asking on the Hub's own
    // first tap is the least intrusive place to do that, and everywhere
    // else this is simply a silent no-op.
    const tilt = attachTilt(byId('screen-hub'));
    byId('screen-hub').addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    // Focus's mini waveform reflects real playback state, live, from
    // wherever it was started (its own screen or Wind Down) — not just
    // clicks made on this screen.
    const focusWave = byId('hub-focus-wave');
    getFocusAudioEngine().onStateChange((state) => {
        focusWave.classList.toggle('is-live', state.playing);
    });
}
/** Updates the Sleep tile's subtitle on the Hub — e.g. "86 · Great last
 * night" once a score exists, left at its default "Log tonight's sleep"
 * until then. Exported so sleep-view.ts can call it after saving a night's
 * log, without the Hub needing to know anything about how Sleep computes
 * that text. */
export function setSleepTileSubtitle(text) {
    byId('hub-sleep-sub').textContent = text;
}
/** Same handoff as setSleepTileSubtitle, for Meditate's own streak text —
 *  e.g. "4-day streak" once one exists, left at its default description
 *  until a first session is actually logged. */
export function setMeditateTileSubtitle(text) {
    byId('hub-meditate-sub').textContent = text;
}
/** Same handoff again, for Vitals' own logging-streak text. */
export function setVitalsTileSubtitle(text) {
    byId('hub-vitals-sub').textContent = text;
}
/** Same handoff again, for Steps' own logging-streak text. */
export function setStepsTileSubtitle(text) {
    byId('hub-steps-sub').textContent = text;
}
/** Same handoff again, for Hydration's own logging-streak text. */
export function setHydrationTileSubtitle(text) {
    byId('hub-hydration-sub').textContent = text;
}
/** Draws the Sleep tile's mini ring in to a real score (0-100), or back to
 * its empty "waiting for data" state for `null` — the same honesty rule as
 * the subtitle: never a number that isn't backed by an actual logged
 * night. */
export function setSleepTileScore(score) {
    const fraction = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
    const offset = HUB_RING_CIRCUMFERENCE * (1 - fraction);
    bySvgId('hub-sleep-ring-fill').setAttribute('stroke-dashoffset', offset.toFixed(2));
    byId('btn-home-sleep').classList.toggle('hub-tile--no-score', score == null);
}
//# sourceMappingURL=hub-view.js.map