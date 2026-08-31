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
import { GUIDED_SESSIONS, getGuidedSession, totalDurationSeconds } from './guided-sessions.js';
import { isVoiceGuideSupported, speak, stopSpeaking } from './voice-guide.js';
import type { GuidedSession, SessionBeat } from './guided-sessions.js';
import type { IconName } from '../../lib/icons.js';

const POLL_MS = 200;

const SESSION_ICON: Record<string, IconName> = {
  'breathing-focus': 'lungs',
  relax: 'leaf',
  focus: 'target',
  'sleep-focus': 'moon-stars',
};

const PACER_PHASE: Record<NonNullable<SessionBeat['breathPhase']>, { scale: number; opacity: number }> = {
  in: { scale: 1.15, opacity: 1 },
  hold: { scale: 1.15, opacity: 1 },
  out: { scale: 0.68, opacity: 0.45 },
  holdEmpty: { scale: 0.68, opacity: 0.45 },
};

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`guided-session-view: missing #${id}`);
  return el as T;
}

export function initGuidedSessionFeature(): void {
  let session: GuidedSession | null = null;
  let beatIndex = 0;
  let elapsedBeforeCurrentBeatMs = 0;
  let countdown: ReturnType<typeof createCountdown> | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  let voiceOn = isVoiceGuideSupported();

  function stopPolling(): void {
    if (pollHandle != null) clearInterval(pollHandle);
    pollHandle = null;
  }

  function applyPacerPhase(phase: SessionBeat['breathPhase']): void {
    const core = byId('guided-session-pacer-core');
    if (!phase) {
      core.style.transform = '';
      core.style.opacity = '';
      return;
    }
    const { scale, opacity } = PACER_PHASE[phase];
    core.style.transform = `scale(${scale})`;
    core.style.opacity = String(opacity);
  }

  function updateVoiceToggleUI(): void {
    const btn = byId('btn-guided-session-voice-toggle');
    btn.setAttribute('aria-pressed', String(voiceOn));
    btn.setAttribute('aria-label', voiceOn ? 'Voice guidance on — tap to turn off' : 'Voice guidance off — tap to turn on');
    btn.style.opacity = voiceOn ? '1' : '0.5';
  }

  function tick(): void {
    if (!session || !countdown) return;
    const beat = session.beats[beatIndex];
    if (!beat) return;

    const elapsedInBeatMs = beat.durationSeconds * 1000 - countdown.getRemainingMs();
    const totalElapsedMs = elapsedBeforeCurrentBeatMs + elapsedInBeatMs;
    const totalMs = totalDurationSeconds(session) * 1000;
    byId('guided-session-progress').style.width = `${Math.min(100, (totalElapsedMs / totalMs) * 100)}%`;

    if (countdown.isFinished()) {
      elapsedBeforeCurrentBeatMs += beat.durationSeconds * 1000;
      launchBeat(beatIndex + 1);
    }
  }

  function launchBeat(index: number): void {
    if (!session) return;
    const beat = session.beats[index];
    if (!beat) {
      endSession();
      return;
    }
    beatIndex = index;
    byId('guided-session-caption').textContent = beat.text;
    if (voiceOn) speak(beat.text);
    applyPacerPhase(beat.breathPhase);

    countdown = createCountdown(beat.durationSeconds * 1000);
    countdown.start();
    stopPolling();
    pollHandle = setInterval(tick, POLL_MS);
    tick();
  }

  function startSession(id: string): void {
    const found = getGuidedSession(id);
    if (!found) return;
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

  function endSession(): void {
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
    if (!voiceOn) stopSpeaking();
    updateVoiceToggleUI();
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

  byId('btn-guided-session-end').addEventListener('click', endSession);
  byId('btn-guided-session-back').addEventListener('click', endSession);
}
