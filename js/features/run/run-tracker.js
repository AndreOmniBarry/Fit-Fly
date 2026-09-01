import { showScreen } from '../../lib/router.js';
import { iconMarkup } from '../../lib/icons.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { createStopwatch, formatDuration } from '../../lib/timer.js';
import { requestWakeLock, releaseWakeLock } from '../../lib/wake-lock.js';
import {
  calculatePaceSecPerKm,
  filterAccuratePoints,
  formatDistance,
  formatPace,
  totalRouteDistanceMeters,
} from './gps-math.js';
import { drawRoute } from './route-canvas.js';
import { detectNewPRs } from './personal-records.js';
import { listAllRuns, saveCompletedRun } from '../../db/repositories/runs.js';

// Purely a UI/canvas re-render cadence — actual distance/duration are
// always computed fresh from the recorded points and the wall-clock
// stopwatch, never accumulated tick-by-tick. Same rule as js/lib/timer.js.
const RENDER_POLL_MS = 1000;

function byId(id) {
  return document.getElementById(id);
}

export function initRunFeature() {
  const stopwatch = createStopwatch();
  let points = [];
  let watchId = null;
  let pollHandle = null;
  let running = false;

  function stopPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = null;
  }

  function render() {
    const filtered = filterAccuratePoints(points);
    const distanceMeters = totalRouteDistanceMeters(filtered);
    const durationMs = stopwatch.getElapsedMs();
    const pace = calculatePaceSecPerKm(distanceMeters, durationMs);

    byId('run-distance').textContent = formatDistance(distanceMeters);
    byId('run-duration').textContent = formatDuration(durationMs);
    byId('run-pace').textContent = formatPace(pace);

    const canvas = byId('run-canvas');
    const accentColor = getComputedStyle(canvas).color || '#000';
    drawRoute(canvas, filtered, accentColor);
  }

  function showGeoError(message) {
    byId('run-geo-error-text').textContent = message;
    byId('run-geo-error').hidden = false;
  }

  function onPosition(position) {
    byId('run-geo-error').hidden = true;
    points.push({
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyM: position.coords.accuracy,
      tMs: position.timestamp,
    });
    render();
  }

  function onPositionError(error) {
    showGeoError(
      error.code === error.PERMISSION_DENIED
        ? 'Location access was denied — allow it in your browser settings to track a run.'
        : 'Location signal lost — this can happen indoors or with a weak GPS fix.'
    );
  }

  function startWatching() {
    if (!('geolocation' in navigator)) {
      showGeoError('This browser doesn\'t support location tracking.');
      return false;
    }
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });
    return true;
  }

  function stopWatching() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  // Same spatial-tilt language as the Fitness Toolkit home list — each of
  // Run's three screens gets its own instance, scoped to itself.
  for (const screenId of ['screen-run', 'screen-run-summary', 'screen-run-history']) {
    const screen = byId(screenId);
    const tilt = attachTilt(screen);
    screen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
  }

  byId('btn-home-run').addEventListener('click', () => {
    resetRunScreen();
    showScreen('screen-run');
  });

  byId('btn-run-back').addEventListener('click', () => {
    if (running && !window.confirm('End this run without saving?')) return;
    stopWatching();
    stopPolling();
    releaseWakeLock();
    running = false;
    showScreen('screen-home');
  });

  byId('btn-run-toggle').addEventListener('click', () => {
    if (running) {
      // pause
      stopWatching();
      stopwatch.pause();
      stopPolling();
      running = false;
      byId('btn-run-toggle').textContent = 'Resume';
      return;
    }

    // start or resume
    if (!startWatching()) return;
    requestWakeLock();
    stopwatch.start();
    pollHandle = setInterval(render, RENDER_POLL_MS);
    running = true;
    byId('btn-run-toggle').textContent = 'Pause';
    byId('btn-run-finish').hidden = false;
    render();
  });

  byId('btn-run-finish').addEventListener('click', async () => {
    stopWatching();
    stopwatch.pause();
    stopPolling();
    await releaseWakeLock();
    running = false;

    const filtered = filterAccuratePoints(points);
    const distanceMeters = totalRouteDistanceMeters(filtered);
    const durationMs = stopwatch.getElapsedMs();
    const avgPaceSecPerKm = calculatePaceSecPerKm(distanceMeters, durationMs);

    const priorRuns = await listAllRuns();
    const prs = detectNewPRs({ distanceMeters, avgPaceSecPerKm }, priorRuns);

    await saveCompletedRun({
      distanceMeters,
      durationMs,
      avgPaceSecPerKm,
      route: filtered,
    });

    renderSummary({ distanceMeters, durationMs, avgPaceSecPerKm }, prs);
    showScreen('screen-run-summary');
  });

  byId('btn-run-summary-done').addEventListener('click', () => showScreen('screen-home'));
  byId('btn-run-summary-history').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-run-history');
  });

  byId('btn-home-run-history').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-run-history');
  });
  byId('btn-run-history-back').addEventListener('click', () => showScreen('screen-home'));

  // A backgrounded tab drops the wake lock automatically (spec behavior)
  // — re-request it once the person comes back, if a run is still going.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running) requestWakeLock();
  });

  function resetRunScreen() {
    stopWatching();
    stopPolling();
    stopwatch.reset();
    points = [];
    running = false;
    byId('run-geo-error').hidden = true;
    byId('btn-run-toggle').textContent = 'Start';
    byId('btn-run-finish').hidden = true;
    render();
  }
}

function renderSummary({ distanceMeters, durationMs, avgPaceSecPerKm }, prs) {
  // The final numbers arriving, same kinetic-data language as the rest of
  // the app — animateCountUp interpolates the raw meters/ms/pace and
  // re-formats each frame with the same real formatters used everywhere
  // else, so what's mid-animation is never a fake or rounded-off number.
  animateCountUp(byId('run-summary-distance'), distanceMeters, { formatter: formatDistance });
  animateCountUp(byId('run-summary-duration'), durationMs, { formatter: formatDuration });
  // A run with no measurable distance/time has no pace at all (see
  // calculatePaceSecPerKm) — null, never a fake number to animate toward.
  if (avgPaceSecPerKm == null) {
    byId('run-summary-pace').textContent = formatPace(avgPaceSecPerKm);
  } else {
    animateCountUp(byId('run-summary-pace'), avgPaceSecPerKm, { formatter: formatPace });
  }

  const badges = [];
  if (prs.isDistancePR) badges.push('New longest run');
  if (prs.isPacePR) badges.push('New fastest pace');
  byId('run-summary-prs').innerHTML = badges
    .map((text) => `<div class="card card-accent row tilt-card tilt-enter" style="align-items:center; gap:var(--space-2);">${iconMarkup('trophy', { size: 18 })}<span>${text}</span></div>`)
    .join('');
}

async function renderHistory() {
  const runs = await listAllRuns();
  const sorted = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const list = byId('run-history-list');

  if (sorted.length === 0) {
    list.innerHTML = '<p class="muted center-text">No runs logged yet — your first run will show up here.</p>';
    return;
  }

  list.innerHTML = sorted
    .map((run) => {
      const dateLabel = new Date(run.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `
        <div class="card row-between tilt-card tilt-enter">
          <span class="row" style="gap:10px; align-items:center;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-wind"></use></svg></span>
            <span>
              <strong>${formatDistance(run.distanceMeters)}</strong>
              <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${dateLabel} · ${formatDuration(run.durationMs)}</p>
            </span>
          </span>
          <span class="data-badge measured">${formatPace(run.avgPaceSecPerKm)}</span>
        </div>
      `;
    })
    .join('');
}
