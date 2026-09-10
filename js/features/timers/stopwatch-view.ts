// A real sports stopwatch — start/lap/split/pause/stop, useful for any
// sport or activity, not tied to a specific exercise or program the way
// the Rest Timer's own countdown is. Wall-clock-based (createStopwatch
// in timer.js), same "elapsed time is always computed from a real
// timestamp, polling only decides when to re-render" honesty as every
// other timer in this app.
//
// Deliberately in-memory only for this session — no lap history is
// written to the database. A real stopwatch resets on you closing it;
// this is that same honest scope, not a half-built "history" feature
// with nothing real behind it.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { createStopwatch } from '../../lib/timer.js';
import type { Stopwatch } from '../../lib/timer.js';
import { playCompletionBeep, playSplitCue, primeAudio, vibrateDevice } from '../../lib/audio-cue.js';
import { getNotificationPermission, showNotification } from '../../lib/notifications.js';
import { buildLapRecord, classifyLaps, formatStopwatchTime } from './stopwatch-laps.js';
import type { LapRecord } from './stopwatch-laps.js';

// Re-rendered fast enough that hundredths actually look alive, not the
// source of truth for elapsed time (getElapsedMs() always computes the
// real value from a wall-clock timestamp — see timer.js's own header
// comment on why that split matters).
const RENDER_POLL_MS = 50;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`stopwatch-view: missing #${id}`);
  return el as T;
}

type StopwatchStatus = 'idle' | 'running' | 'paused';

export function initStopwatchFeature(): void {
  const screen = byId('screen-stopwatch');
  const tilt = attachTilt(screen);
  screen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });

  const stopwatch: Stopwatch = createStopwatch();
  let laps: LapRecord[] = [];
  let pollHandle: ReturnType<typeof setInterval> | null = null;
  // Every whole alert-interval-minute already alerted for this run, so a
  // 50ms poll cadence can't fire the same real minute mark twice.
  let lastAlertedMinute = 0;
  let alertIntervalMinutes = 0; // 0 = off

  function status(): StopwatchStatus {
    if (stopwatch.running) return 'running';
    return stopwatch.getElapsedMs() > 0 ? 'paused' : 'idle';
  }

  function startPolling(): void {
    stopPolling();
    pollHandle = setInterval(render, RENDER_POLL_MS);
  }
  function stopPolling(): void {
    if (pollHandle != null) clearInterval(pollHandle);
    pollHandle = null;
  }

  function checkAlert(elapsedMs: number): void {
    if (alertIntervalMinutes <= 0) return;
    const wholeMinutes = Math.floor(elapsedMs / 60_000);
    if (wholeMinutes <= 0 || wholeMinutes === lastAlertedMinute || wholeMinutes % alertIntervalMinutes !== 0) return;
    lastAlertedMinute = wholeMinutes;
    playCompletionBeep();
    vibrateDevice([120, 80, 120]);
    if (getNotificationPermission() === 'granted') {
      showNotification(`${wholeMinutes} min elapsed`, {
        body: `Stopwatch alert — ${formatStopwatchTime(elapsedMs)} and counting.`,
        tag: 'fit-fly-stopwatch-alert',
      });
    }
  }

  function render(): void {
    const elapsedMs = stopwatch.getElapsedMs();
    byId('stopwatch-display').textContent = formatStopwatchTime(elapsedMs);
    renderButtons();
    renderFab(elapsedMs);
    if (stopwatch.running) checkAlert(elapsedMs);
  }

  function renderButtons(): void {
    const s = status();
    const primary = byId<HTMLButtonElement>('btn-stopwatch-primary');
    const secondary = byId<HTMLButtonElement>('btn-stopwatch-secondary');

    if (s === 'idle') {
      primary.textContent = 'Start';
      secondary.textContent = 'Lap';
      secondary.disabled = true;
    } else if (s === 'running') {
      primary.textContent = 'Pause';
      secondary.textContent = 'Lap';
      secondary.disabled = false;
    } else {
      primary.textContent = 'Resume';
      secondary.textContent = 'Reset';
      secondary.disabled = false;
    }
    byId('stopwatch-status').textContent = s === 'running' ? 'Running' : s === 'paused' ? 'Paused' : 'Ready';
  }

  function renderLaps(): void {
    const list = byId('stopwatch-laps');
    if (laps.length === 0) {
      list.innerHTML = '<p class="muted center-text" style="font-size:var(--fs-sm);">No laps yet — tap Lap while running to record one.</p>';
      return;
    }
    const highlights = classifyLaps(laps);
    list.innerHTML = [...laps]
      .reverse() // newest first
      .map((lap) => {
        const isFastest = lap.lapNumber === highlights.fastestLapNumber;
        const isSlowest = lap.lapNumber === highlights.slowestLapNumber;
        const cls = isFastest ? 'stopwatch-lap-row--fastest' : isSlowest ? 'stopwatch-lap-row--slowest' : '';
        const badge = isFastest ? '<span class="stopwatch-lap-badge">Fastest</span>' : isSlowest ? '<span class="stopwatch-lap-badge">Slowest</span>' : '';
        return `
          <div class="stopwatch-lap-row ${cls}">
            <span class="stopwatch-lap-number">Lap ${lap.lapNumber}</span>
            <span class="stopwatch-lap-time">${formatStopwatchTime(lap.lapMs)}${badge}</span>
            <span class="stopwatch-lap-split muted">split ${formatStopwatchTime(lap.splitMs)}</span>
          </div>
        `;
      })
      .join('');
  }

  // ---------- the floating "loitering" button, same always-reachable
  // pattern as the voice mic FAB (#btn-voice-toggle in index.html) —
  // visible on every *other* screen while a session is actually active,
  // so leaving mid-activity never silently drops it. A MutationObserver
  // on this screen's own `hidden` attribute (rather than a change to the
  // shared router) is what notices "the user just navigated away". ----------
  function renderFab(elapsedMs: number): void {
    const fab = byId('btn-stopwatch-fab');
    const isHere = !screen.hidden;
    const active = status() !== 'idle';
    fab.hidden = isHere || !active;
    if (!fab.hidden) fab.textContent = formatStopwatchTime(elapsedMs);
  }

  new MutationObserver(() => renderFab(stopwatch.getElapsedMs())).observe(screen, {
    attributes: true,
    attributeFilter: ['hidden'],
  });

  byId('btn-stopwatch-fab').addEventListener('click', () => showScreen('screen-stopwatch'));

  // ---------- wiring ----------
  byId('btn-stopwatch-primary').addEventListener('click', () => {
    primeAudio(); // inside this click's call stack, so an alert beep can actually play later
    if (stopwatch.running) {
      stopwatch.pause();
      stopPolling();
    } else {
      stopwatch.start();
      startPolling();
    }
    render();
  });

  byId('btn-stopwatch-secondary').addEventListener('click', () => {
    const s = status();
    if (s === 'running') {
      const previousSplit = laps.length > 0 ? (laps[laps.length - 1] as LapRecord).splitMs : 0;
      laps = [...laps, buildLapRecord(laps.length + 1, previousSplit, stopwatch.getElapsedMs())];
      // Split cue's own real cue (already built for Run's live km splits —
      // see audio-cue.js) plus a light tactile buzz, both distinct from the
      // interval alert's longer completion-beep-and-buzz below.
      playSplitCue();
      vibrateDevice(15);
      renderLaps();
    } else if (s === 'paused') {
      stopwatch.reset();
      laps = [];
      lastAlertedMinute = 0;
      renderLaps();
      render();
    }
  });

  initChipGroup<string>(byId('stopwatch-alert-interval'), {
    initial: '0',
    onChange: (value) => {
      alertIntervalMinutes = Number(value);
      lastAlertedMinute = 0; // a newly-set interval starts counting from now, not from a stale mark
    },
  });

  byId('btn-stopwatch-back').addEventListener('click', () => showScreen('screen-home'));
  byId('btn-home-stopwatch').addEventListener('click', () => showScreen('screen-stopwatch'));

  render();
  renderLaps();
}
