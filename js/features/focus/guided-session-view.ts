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
import { getVoiceEngine, isVoiceGuideSupported, speak, stopSpeaking } from './voice-guide.js';
import { getKokoroDownloadProgress, isKokoroLoading } from './kokoro-voice.js';
import type { GuidedSession, SessionBeat } from './guided-sessions.js';
import type { IconName } from '../../lib/icons.js';

const POLL_MS = 200;

const SESSION_ICON: Record<string, IconName> = {
  'breathing-focus': 'lungs',
  relax: 'leaf',
  focus: 'target',
  'sleep-focus': 'moon-stars',
};

const PACER_PHASE: Record<NonNullable<SessionBeat['breathPhase']>, { scale: number; opacity: number; brightness: number }> = {
  in: { scale: 1.15, opacity: 1, brightness: 1.18 },
  hold: { scale: 1.15, opacity: 1, brightness: 1.05 },
  out: { scale: 0.68, opacity: 0.45, brightness: 0.85 },
  holdEmpty: { scale: 0.68, opacity: 0.45, brightness: 0.85 },
};

// The core swings the full amount; the mid and outer rings only follow a
// fraction of that swing (and, per mini-apps.css, arrive a beat later) —
// what turns three dots scaling in lockstep into something that reads as
// a ripple moving outward through real depth.
const RING_AMPLITUDE = { core: 1, mid: 0.7, outer: 0.45 } as const;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`guided-session-view: missing #${id}`);
  return el as T;
}

/** Scales a ring's swing around its resting scale(1) by `amplitude` —
 *  every ring still centers on the same resting size, only how far it
 *  moves from it differs. */
function ringTransform(baseScale: number, amplitude: number): string {
  const delta = (baseScale - 1) * amplitude;
  return `scale(${(1 + delta).toFixed(3)})`;
}

/** Returned by initGuidedSessionFeature() so another mini-app (Meditate)
 *  can play a session from its own library through this same shared
 *  screen — pacer, voice guidance, countdown and all — rather than
 *  building a second copy of any of it. `returnScreenId` is where "End"/
 *  "Back" lands; `onComplete`, when given, fires only when the session
 *  finishes on its own (every beat played through), never on an early
 *  exit, so a caller can log a real completed session without double-
 *  counting an abandoned one. */
export interface GuidedSessionPlayerHandle {
  playGuidedSession(
    session: GuidedSession,
    returnScreenId: string,
    options?: { onComplete?: (session: GuidedSession) => void; themeClass?: string }
  ): void;
}

export function initGuidedSessionFeature(): GuidedSessionPlayerHandle {
  let session: GuidedSession | null = null;
  let beatIndex = 0;
  let elapsedBeforeCurrentBeatMs = 0;
  let countdown: ReturnType<typeof createCountdown> | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  let voiceOn = isVoiceGuideSupported();
  let returnScreenId = 'screen-focus';
  let onComplete: ((session: GuidedSession) => void) | null = null;
  let currentThemeClass = 'theme-focus';

  function stopPolling(): void {
    if (pollHandle != null) clearInterval(pollHandle);
    pollHandle = null;
  }

  /** Drives all four of a breath phase's sensory channels at once: each
   *  ring's size and brightness (see PACER_PHASE/RING_AMPLITUDE and the
   *  matching mini-apps.css block for why three rings, not one), the
   *  transition's real duration (matching the beat exactly, never a
   *  guessed constant), and — the one non-visual channel — a haptic pulse
   *  on devices that support it. `durationSeconds` is unused (and no
   *  transition/haptic fires) when clearing the pacer between sessions. */
  function applyPacerPhase(phase: SessionBeat['breathPhase'], durationSeconds?: number): void {
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
      if (phase === 'in') vibrateDevice(25);
      else if (phase === 'out') vibrateDevice([15, 30, 15]);
    }
  }

  function updateVoiceToggleUI(): void {
    const btn = byId('btn-guided-session-voice-toggle');
    btn.setAttribute('aria-pressed', String(voiceOn));
    btn.setAttribute('aria-label', voiceOn ? 'Voice guidance on — tap to turn off' : 'Voice guidance off — tap to turn on');
    btn.style.opacity = voiceOn ? '1' : '0.5';
  }

  /** The one visible sign that Kokoro's one-time download (see voice-
   *  guide.ts's speak(), which is what actually triggers it) is running
   *  in the background — deliberately placed inside the session someone
   *  is already sitting through, not a separate download screen easy to
   *  wander away from and lose progress on (a real fetch discarded
   *  mid-flight can't resume — see kokoro-voice.ts). Hidden the instant
   *  it's ready, failed, or simply not using Kokoro — never a lingering
   *  banner once there's nothing left to report. */
  function updateVoiceStatusUI(): void {
    const el = byId('guided-session-voice-status');
    if (voiceOn && getVoiceEngine() === 'kokoro' && isKokoroLoading()) {
      const progress = getKokoroDownloadProgress();
      el.textContent = progress ? `Preparing your natural voice… ${progress.percent}%` : 'Preparing your natural voice…';
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function tick(): void {
    if (!session || !countdown) return;
    const beat = session.beats[beatIndex];
    if (!beat) return;

    const elapsedInBeatMs = beat.durationSeconds * 1000 - countdown.getRemainingMs();
    const totalElapsedMs = elapsedBeforeCurrentBeatMs + elapsedInBeatMs;
    const totalMs = totalDurationSeconds(session) * 1000;
    byId('guided-session-progress').style.width = `${Math.min(100, (totalElapsedMs / totalMs) * 100)}%`;
    updateVoiceStatusUI();

    if (countdown.isFinished()) {
      elapsedBeforeCurrentBeatMs += beat.durationSeconds * 1000;
      launchBeat(beatIndex + 1);
    }
  }

  function launchBeat(index: number): void {
    if (!session) return;
    const beat = session.beats[index];
    if (!beat) {
      endSession(true);
      return;
    }
    beatIndex = index;
    byId('guided-session-caption').textContent = beat.text;
    if (voiceOn) speak(beat.text);
    applyPacerPhase(beat.breathPhase, beat.durationSeconds);

    countdown = createCountdown(beat.durationSeconds * 1000);
    countdown.start();
    stopPolling();
    pollHandle = setInterval(tick, POLL_MS);
    tick();
  }

  function playGuidedSession(
    found: GuidedSession,
    returnTo: string,
    options?: { onComplete?: (session: GuidedSession) => void; themeClass?: string }
  ): void {
    session = found;
    beatIndex = 0;
    elapsedBeforeCurrentBeatMs = 0;
    returnScreenId = returnTo;
    onComplete = options?.onComplete ?? null;

    // The shared player screen is styled by whichever mini-app launched it
    // — a Meditate session should read as Meditate's own dusk palette, not
    // borrow Focus's teal/mint just because they share one screen.
    const playerScreen = byId('screen-guided-session');
    playerScreen.classList.remove(currentThemeClass);
    currentThemeClass = options?.themeClass ?? 'theme-focus';
    playerScreen.classList.add(currentThemeClass);

    byId('guided-session-title').textContent = found.name;
    byId('btn-guided-session-pause').textContent = 'Pause';
    byId('guided-session-progress').style.width = '0%';
    updateVoiceToggleUI();
    showScreen('screen-guided-session');
    launchBeat(0);
  }

  function startSession(id: string): void {
    const found = getGuidedSession(id);
    if (!found) return;
    playGuidedSession(found, 'screen-focus');
  }

  function endSession(completedNaturally: boolean): void {
    stopPolling();
    stopSpeaking();
    countdown = null;
    const finishedSession = session;
    const completeCb = onComplete;
    session = null;
    onComplete = null;
    applyPacerPhase(undefined);
    byId('guided-session-voice-status').hidden = true;
    if (completedNaturally && finishedSession && completeCb) completeCb(finishedSession);
    showScreen(returnScreenId);
  }

  const grid = byId('guided-session-grid');
  GUIDED_SESSIONS.forEach((guidedSession, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'focus-sound-tile tilt-card tilt-enter';
    tile.id = `btn-guided-session-${guidedSession.id}`;
    tile.style.animationDelay = `${index * 0.05}s`;
    tile.innerHTML = `<span class="focus-sound-tile-face tilt-press"><span data-tilt-depth="1">${iconMarkup(SESSION_ICON[guidedSession.id] ?? 'target', { size: 20 })}</span><span class="name">${guidedSession.name}</span></span>`;
    tile.title = guidedSession.description;
    tile.addEventListener('click', () => startSession(guidedSession.id));
    grid.append(tile);
  });

  byId('btn-guided-session-voice-toggle').addEventListener('click', () => {
    voiceOn = !voiceOn;
    if (!voiceOn) stopSpeaking();
    updateVoiceToggleUI();
    updateVoiceStatusUI();
  });

  byId('btn-guided-session-pause').addEventListener('click', () => {
    if (!countdown) return;
    if (countdown.running) {
      countdown.pause();
      stopSpeaking();
      stopPolling();
      byId('btn-guided-session-pause').textContent = 'Resume';
    } else {
      countdown.start();
      pollHandle = setInterval(tick, POLL_MS);
      byId('btn-guided-session-pause').textContent = 'Pause';
    }
  });

  byId('btn-guided-session-end').addEventListener('click', () => endSession(false));
  byId('btn-guided-session-back').addEventListener('click', () => endSession(false));

  return { playGuidedSession };
}
