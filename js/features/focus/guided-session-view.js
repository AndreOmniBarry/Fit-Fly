// Plays a guided session (see guided-sessions.ts) beat by beat, on the
// same wall-clock-timer discipline as every other timer in this app
// (js/lib/timer.js) — a breathing exercise has to be metronomic regardless
// of how long text-to-speech actually takes to say a line, so pacing is
// never derived from speech duration. The caption is always on screen,
// never voice-only: voice guidance (voice-guide.ts) is a real
// enhancement, switchable off entirely, not a dependency the session
// needs to make sense.
import { showScreen } from '../../lib/router.js';
import { createCountdown } from '../../lib/timer.js';
import { iconMarkup } from '../../lib/icons.js';
import { prefersReducedMotion } from '../../lib/motion.js';
import { vibrateDevice } from '../../lib/audio-cue.js';
import { GUIDED_SESSIONS, getGuidedSession, totalDurationSeconds } from './guided-sessions.js';
import { isVoiceGuideSupported, speak, stopSpeaking } from './voice-guide.js';
const POLL_MS = 200;
const SESSION_ICON = {
    'breathing-focus': 'lungs',
    relax: 'leaf',
    focus: 'target',
    'sleep-focus': 'moon-stars',
};
const PACER_PHASE = {
    in: { scale: 1.15, opacity: 1, brightness: 1.18 },
    hold: { scale: 1.15, opacity: 1, brightness: 1.05 },
    out: { scale: 0.68, opacity: 0.45, brightness: 0.85 },
    holdEmpty: { scale: 0.68, opacity: 0.45, brightness: 0.85 },
};
// The core swings the full amount; the mid and outer rings only follow a
// fraction of that swing (and, per mini-apps.css, arrive a beat later) —
// what turns three dots scaling in lockstep into something that reads as
// a ripple moving outward through real depth.
const RING_AMPLITUDE = { core: 1, mid: 0.7, outer: 0.45 };
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`guided-session-view: missing #${id}`);
    return el;
}
/** Scales a ring's swing around its resting scale(1) by `amplitude` —
 *  every ring still centers on the same resting size, only how far it
 *  moves from it differs. */
function ringTransform(baseScale, amplitude) {
    const delta = (baseScale - 1) * amplitude;
    return `scale(${(1 + delta).toFixed(3)})`;
}
export function initGuidedSessionFeature() {
    let session = null;
    let beatIndex = 0;
    let elapsedBeforeCurrentBeatMs = 0;
    let countdown = null;
    let pollHandle = null;
    let voiceOn = isVoiceGuideSupported();
    function stopPolling() {
        if (pollHandle != null)
            clearInterval(pollHandle);
        pollHandle = null;
    }
    /** Drives all four of a breath phase's sensory channels at once: each
     *  ring's size and brightness (see PACER_PHASE/RING_AMPLITUDE and the
     *  matching mini-apps.css block for why three rings, not one), the
     *  transition's real duration (matching the beat exactly, never a
     *  guessed constant), and — the one non-visual channel — a haptic pulse
     *  on devices that support it. `durationSeconds` is unused (and no
     *  transition/haptic fires) when clearing the pacer between sessions. */
    function applyPacerPhase(phase, durationSeconds) {
        const pacer = byId('guided-session-pacer');
        const core = byId('guided-session-pacer-core');
        const mid = byId('guided-session-pacer-mid');
        const outer = byId('guided-session-pacer-outer');
        if (!phase) {
            for (const ring of [core, mid, outer]) {
                ring.style.transform = '';
                ring.style.opacity = '';
                ring.style.filter = '';
            }
            return;
        }
        pacer.style.setProperty('--pacer-transition-ms', `${durationSeconds ?? 4}s`);
        const { scale, opacity, brightness } = PACER_PHASE[phase];
        core.style.transform = ringTransform(scale, RING_AMPLITUDE.core);
        core.style.opacity = String(opacity);
        core.style.filter = `brightness(${brightness})`;
        mid.style.transform = ringTransform(scale, RING_AMPLITUDE.mid);
        mid.style.opacity = String(0.5 + opacity * 0.4);
        mid.style.filter = `brightness(${brightness})`;
        outer.style.transform = ringTransform(scale, RING_AMPLITUDE.outer);
        outer.style.opacity = String(0.3 + opacity * 0.3);
        outer.style.filter = `brightness(${brightness})`;
        // A fourth, non-visual channel — only at the start of an actual
        // in/out transition (holds are stillness; a buzz there would
        // contradict the point), best-effort and a silent no-op wherever the
        // Vibration API doesn't exist (all of iOS Safari, most desktop
        // browsers). Skipped under reduced-motion too — less stimulation is
        // the whole ask, not just less visual motion.
        if (!prefersReducedMotion()) {
            if (phase === 'in')
                vibrateDevice(25);
            else if (phase === 'out')
                vibrateDevice([15, 30, 15]);
        }
    }
    function updateVoiceToggleUI() {
        const btn = byId('btn-guided-session-voice-toggle');
        btn.setAttribute('aria-pressed', String(voiceOn));
        btn.setAttribute('aria-label', voiceOn ? 'Voice guidance on — tap to turn off' : 'Voice guidance off — tap to turn on');
        btn.style.opacity = voiceOn ? '1' : '0.5';
    }
    function tick() {
        if (!session || !countdown)
            return;
        const beat = session.beats[beatIndex];
        if (!beat)
            return;
        const elapsedInBeatMs = beat.durationSeconds * 1000 - countdown.getRemainingMs();
        const totalElapsedMs = elapsedBeforeCurrentBeatMs + elapsedInBeatMs;
        const totalMs = totalDurationSeconds(session) * 1000;
        byId('guided-session-progress').style.width = `${Math.min(100, (totalElapsedMs / totalMs) * 100)}%`;
        if (countdown.isFinished()) {
            elapsedBeforeCurrentBeatMs += beat.durationSeconds * 1000;
            launchBeat(beatIndex + 1);
        }
    }
    function launchBeat(index) {
        if (!session)
            return;
        const beat = session.beats[index];
        if (!beat) {
            endSession();
            return;
        }
        beatIndex = index;
        byId('guided-session-caption').textContent = beat.text;
        if (voiceOn)
            speak(beat.text);
        applyPacerPhase(beat.breathPhase, beat.durationSeconds);
        countdown = createCountdown(beat.durationSeconds * 1000);
        countdown.start();
        stopPolling();
        pollHandle = setInterval(tick, POLL_MS);
        tick();
    }
    function startSession(id) {
        const found = getGuidedSession(id);
        if (!found)
            return;
        session = found;
        beatIndex = 0;
        elapsedBeforeCurrentBeatMs = 0;
        byId('guided-session-title').textContent = found.name;
        byId('btn-guided-session-pause').textContent = 'Pause';
        byId('guided-session-progress').style.width = '0%';
        updateVoiceToggleUI();
        showScreen('screen-guided-session');
        launchBeat(0);
    }
    function endSession() {
        stopPolling();
        stopSpeaking();
        countdown = null;
        session = null;
        applyPacerPhase(undefined);
        showScreen('screen-focus');
    }
    const grid = byId('guided-session-grid');
    for (const guidedSession of GUIDED_SESSIONS) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'focus-sound-tile';
        tile.id = `btn-guided-session-${guidedSession.id}`;
        tile.innerHTML = `${iconMarkup(SESSION_ICON[guidedSession.id] ?? 'target', { size: 20 })}<span class="name">${guidedSession.name}</span>`;
        tile.title = guidedSession.description;
        tile.addEventListener('click', () => startSession(guidedSession.id));
        grid.append(tile);
    }
    byId('btn-guided-session-voice-toggle').addEventListener('click', () => {
        voiceOn = !voiceOn;
        if (!voiceOn)
            stopSpeaking();
        updateVoiceToggleUI();
    });
    byId('btn-guided-session-pause').addEventListener('click', () => {
        if (!countdown)
            return;
        if (countdown.running) {
            countdown.pause();
            stopSpeaking();
            stopPolling();
            byId('btn-guided-session-pause').textContent = 'Resume';
        }
        else {
            countdown.start();
            pollHandle = setInterval(tick, POLL_MS);
            byId('btn-guided-session-pause').textContent = 'Pause';
        }
    });
    byId('btn-guided-session-end').addEventListener('click', endSession);
    byId('btn-guided-session-back').addEventListener('click', endSession);
}
//# sourceMappingURL=guided-session-view.js.map