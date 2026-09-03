import { showScreen } from '../../lib/router.js';
import { iconMarkup } from '../../lib/icons.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { createStopwatch, formatDuration } from '../../lib/timer.js';
import { requestWakeLock, releaseWakeLock } from '../../lib/wake-lock.js';
import { primeAudio, playSplitCue, vibrateDevice } from '../../lib/audio-cue.js';
import { isNativeRuntime } from '../../lib/native-runtime.js';
import { calculatePaceSecPerKm, filterAccuratePoints, recentPaceSecPerKm, totalRouteDistanceMeters } from './gps-math.js';
import { computeSplits } from './splits.js';
import {
  formatDistanceForUnit,
  formatPaceForUnit,
  getDistanceUnit,
  setDistanceUnit,
  splitBoundaryMetersForUnit,
} from './run-units.js';
import { drawRoute } from './route-canvas.js';
import { detectNewPRs } from './personal-records.js';
import { assessGpsSignalQuality } from './gps-signal-quality.js';
import { isNativeBackgroundGeoAvailable, startNativeBackgroundWatch } from './native-background-geo.js';
import { estimateRunCalories } from './run-calorie-estimate.js';
import { listAllRuns, saveCompletedRun } from '../../db/repositories/runs.js';
import { getProfile } from '../../db/repositories/profile.js';
import { setRunTileSubtitle } from '../hub/hub-view.js';

const DEFAULT_TILE_SUBTITLE = 'GPS-tracked, live pace & splits';

/** Updates the Hub tile with the most recent real run — distance and
 *  date, the same "real number or an honest default, never a fabricated
 *  one" rule as every other tile's subtitle. Called once at startup (so
 *  the Hub's first paint already reflects prior history) and again right
 *  after a run is saved. */
async function refreshRunTile() {
  const runs = await listAllRuns();
  if (runs.length === 0) {
    setRunTileSubtitle(DEFAULT_TILE_SUBTITLE);
    return;
  }
  const latest = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const dateLabel = new Date(latest.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  setRunTileSubtitle(`${formatDistanceForUnit(latest.distanceMeters, getDistanceUnit())} · ${dateLabel}`);
}

// "How far back counts as *now*" for the live pace readout — long enough
// that a couple of noisy GPS fixes don't swing it wildly, short enough
// that it actually reacts within the run instead of just re-deriving the
// whole-run average.
const LIVE_PACE_WINDOW_MS = 30000;

// The web platform's real limit here — no service worker keeps a GPS
// watch alive once the app isn't the foregrounded, active tab, so
// tracking needs the screen open and awake (see js/lib/wake-lock.js).
// Once this project is wrapped with Capacitor, a real native background-
// geolocation plugin removes that limit — js/lib/native-runtime.js's
// isNativeRuntime() is the seam that becomes true then, with no code
// change needed here beyond this message. Provably false in every
// browser context today, same contract as every other feature-detected
// API in this app.
function backgroundTrackingNote() {
  return isNativeRuntime()
    ? 'This device tracks your run in the background — you can lock the screen or switch apps.'
    : "Keep this screen open and awake while you run — a web app can't track your route once the screen locks or you switch apps.";
}

/** Renders a splits list into `container` — shared by the live screen,
 *  the summary, and history, so the three don't drift out of sync with
 *  each other on formatting. Newest split first: mid-run, that's the one
 *  someone glancing down actually wants to see without scrolling. */
function renderSplitsList(container, splits, unit) {
  if (splits.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = [...splits]
    .reverse()
    .map(
      (split) => `
        <div class="row-between" style="font-size:var(--fs-sm);">
          <span class="muted">${unit === 'mi' ? 'Mile' : 'Km'} ${split.splitNumber}</span>
          <strong>${formatPaceForUnit(calculatePaceSecPerKm(split.distanceMeters, split.durationMs), unit)}</strong>
        </div>
      `
    )
    .join('');
}

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
  // The native background-geolocation watcher, when active — see
  // startWatching()/stopWatching() below. null on the plain web build,
  // always.
  let nativeWatcher = null;
  let pollHandle = null;
  let running = false;
  // Snapshotted once per run (at start) rather than re-queried every
  // render tick — a live "on pace for a PR" read only needs to be
  // approximately live, not a fresh DB round-trip every second.
  let priorRunsForThisSession = [];
  // How many splits existed as of the last render — the only way to
  // tell "a new split was *just* crossed" (play the cue) apart from "the
  // same splits list, re-rendered again this tick" (stay silent).
  let lastSplitCount = 0;

  function stopPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = null;
  }

  function currentUnit() {
    return getDistanceUnit();
  }

  function render() {
    const unit = currentUnit();
    const filtered = filterAccuratePoints(points);
    const distanceMeters = totalRouteDistanceMeters(filtered);
    const durationMs = stopwatch.getElapsedMs();
    const avgPace = calculatePaceSecPerKm(distanceMeters, durationMs);
    // The live "speedometer" reading is how fast the last 30s actually
    // were, not the average since Start — that's what makes it useful
    // mid-run rather than just a slower-to-move copy of the avg pace
    // below it. Falls back to the whole-run average early on, before
    // there's enough recent history to measure a window from.
    const livePace = recentPaceSecPerKm(filtered, LIVE_PACE_WINDOW_MS) ?? avgPace;

    byId('run-distance').textContent = formatDistanceForUnit(distanceMeters, unit);
    byId('run-duration').textContent = formatDuration(durationMs);
    byId('run-pace').textContent = formatPaceForUnit(livePace, unit);
    byId('run-avg-pace-caption').textContent = `avg ${formatPaceForUnit(avgPace, unit)}`;

    const canvas = byId('run-canvas');
    const accentColor = getComputedStyle(canvas).color || '#000';
    drawRoute(canvas, filtered, accentColor);

    const liveSplits = computeSplits(filtered, splitBoundaryMetersForUnit(unit));
    renderSplitsList(byId('run-live-splits'), liveSplits, unit);
    // A real running-app touch: an audible + haptic cue the instant a
    // new split is actually crossed, not on every render tick re-drawing
    // the same list. Both calls are best-effort/no-ops if audio was
    // never primed by a user gesture or the device has no vibration API
    // — see audio-cue.js's own comment.
    if (liveSplits.length > lastSplitCount) {
      playSplitCue();
      vibrateDevice([120]);
    }
    lastSplitCount = liveSplits.length;

    // GPS quality: the same "give a person something to react to" fix
    // as heart rate's live signal-quality feedback, just for the fix
    // accuracy filterAccuratePoints already silently filters on — read
    // from the latest *raw* point (even one just filtered out) so a
    // weak-signal message can actually explain why distance stalled.
    const latestAccuracyM = points.length > 0 ? points[points.length - 1].accuracyM : null;
    const quality = assessGpsSignalQuality(latestAccuracyM);
    byId('run-gps-dot').dataset.quality = quality.level;
    byId('run-gps-quality-text').textContent = quality.message;

    // Guarded on real movement — detectNewPRs alone would call an empty
    // run (0m, right after Start) a "distance PR" against no prior runs,
    // which is technically true but meaningless to show anyone.
    const prs = distanceMeters > 0 ? detectNewPRs({ distanceMeters, avgPaceSecPerKm: avgPace }, priorRunsForThisSession) : { isDistancePR: false, isPacePR: false };
    const badge = byId('run-live-pr-badge');
    if (prs.isDistancePR || prs.isPacePR) {
      byId('run-live-pr-badge-text').textContent = prs.isDistancePR && prs.isPacePR
        ? 'On pace for a new distance and pace best'
        : prs.isDistancePR
          ? 'On pace for a new distance best'
          : 'On pace for a new fastest pace';
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function showGeoError(message) {
    byId('run-geo-error-text').textContent = message;
    byId('run-geo-error').hidden = false;
  }

  function hideGeoError() {
    byId('run-geo-error').hidden = true;
  }

  function onPosition(position) {
    hideGeoError();
    points.push({
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyM: position.coords.accuracy,
      tMs: position.timestamp,
    });
    render();
  }

  // A denial is where "even though I granted it" reports usually come
  // from a real platform quirk, not a bug here: an app installed via "Add
  // to Home Screen" runs as its own origin-scoped context on iOS, with
  // its own separate location permission from the Safari tab it was
  // installed from — granting it in one doesn't grant it in the other.
  // The copy below says so plainly instead of just repeating "check your
  // browser settings," which is exactly the instruction that doesn't fix
  // it for that case.
  function onPositionError(error) {
    showGeoError(
      error.code === error.PERMISSION_DENIED
        ? "Location access is off for this app. If you installed Fit Fly to your home screen, it has its own permission — separate from Safari/Chrome's — so check this app's own entry in your phone's Settings, not the browser's."
        : 'Location signal lost — this can happen indoors or with a weak GPS fix. Keep moving toward open sky and it should recover.'
    );
  }

  async function startWatching() {
    // A fresh attempt supersedes whatever error the last one left up —
    // never leave a stale "denied" banner showing through a retry that's
    // actually in flight, which reads as permanently stuck even once the
    // underlying permission is genuinely fixed. Clearing any prior watch
    // first also makes this safe to call more than once in a row (e.g. a
    // double-tap on Try Again) without leaking a second live watch.
    hideGeoError();
    stopWatching();

    if (isNativeBackgroundGeoAvailable()) {
      nativeWatcher = await startNativeBackgroundWatch({
        onPosition: (point) => {
          hideGeoError();
          points.push(point);
          render();
        },
        onError: (error) => showGeoError(error.message),
      });
      return nativeWatcher != null;
    }

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
    if (nativeWatcher) {
      nativeWatcher.stop();
      nativeWatcher = null;
    }
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

  // Persisted the same way theme is (js/lib/storage.js) — applies to the
  // live screen, the summary, and history alike, even though the toggle
  // control itself only lives here.
  byId('run-unit-toggle').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-unit]');
    if (!btn) return;
    setDistanceUnit(btn.dataset.unit);
    byId('run-unit-toggle').querySelectorAll('[data-unit]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip === btn));
    });
    render(); // reflect the new unit immediately, not on the next tick
  });

  // Navigation itself (showScreen) is hub-view.ts's job, same as every
  // other Hub tile — this listener is Run's own side effect on open,
  // same split as Steps'/Hydration's own "void refreshAll()" listeners.
  byId('btn-home-run').addEventListener('click', () => resetRunScreen());

  byId('btn-run-back').addEventListener('click', () => {
    if (running && !window.confirm('End this run without saving?')) return;
    stopWatching();
    stopPolling();
    releaseWakeLock();
    running = false;
    showScreen('screen-hub');
  });

  async function startOrResume() {
    // Must happen inside this real click handler — Web Audio requires a
    // user gesture to unlock playback, and the split cue fires later,
    // asynchronously, from inside render() (see audio-cue.js).
    primeAudio();
    if (!(await startWatching())) return;
    requestWakeLock();
    stopwatch.start();
    stopPolling(); // idempotent — never leak a second interval on a repeat tap
    pollHandle = setInterval(render, RENDER_POLL_MS);
    running = true;
    byId('btn-run-toggle').textContent = 'Pause';
    byId('btn-run-finish').hidden = false;
    byId('run-gps-quality').hidden = false;
    // Best-effort, fire-and-forget — used only for the live "on pace for
    // a PR" badge above; a run started before this resolves just shows
    // the badge a tick later than one started after, never blocks Start.
    listAllRuns()
      .then((runs) => {
        priorRunsForThisSession = runs;
      })
      .catch(() => {});
    render();
  }

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
    startOrResume();
  });

  // The error banner's own Try Again — same start/resume path the main
  // button uses, so a fixed permission (or a signal that's come back)
  // recovers without leaving the run screen.
  byId('btn-run-geo-retry').addEventListener('click', () => startOrResume());

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

    const [priorRuns, profile] = await Promise.all([listAllRuns(), getProfile()]);
    const prs = detectNewPRs({ distanceMeters, avgPaceSecPerKm }, priorRuns);
    const splits = computeSplits(filtered, splitBoundaryMetersForUnit(currentUnit()));
    // Always ESTIMATED, never MEASURED — there's no calorie sensor here.
    // null (no profile weight on file yet) just skips the row entirely
    // rather than showing a fabricated number — see renderSummary.
    const calories = estimateRunCalories({ durationMs, avgPaceSecPerKm, weightKg: profile?.weightKg });

    await saveCompletedRun({
      distanceMeters,
      durationMs,
      avgPaceSecPerKm,
      route: filtered,
    });
    void refreshRunTile();

    renderSummary({ distanceMeters, durationMs, avgPaceSecPerKm, calories }, prs, splits, currentUnit());
    showScreen('screen-run-summary');
  });

  byId('btn-run-summary-done').addEventListener('click', () => showScreen('screen-hub'));
  byId('btn-run-summary-history').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-run-history');
  });

  // Same id and behavior as before — just relocated from a standalone
  // Fitness Toolkit list entry into a small icon-button on the live
  // screen's own header, now that Run has somewhere of its own to live.
  byId('btn-home-run-history').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-run-history');
  });
  byId('btn-run-history-back').addEventListener('click', () => showScreen('screen-hub'));

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
    priorRunsForThisSession = [];
    lastSplitCount = 0;
    hideGeoError();
    byId('run-live-pr-badge').hidden = true;
    byId('btn-run-toggle').textContent = 'Start';
    byId('btn-run-finish').hidden = true;
    byId('run-gps-quality').hidden = true;
    byId('run-background-note-text').textContent = backgroundTrackingNote();
    const unit = currentUnit();
    byId('run-unit-toggle').querySelectorAll('[data-unit]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.unit === unit));
    });
    render();
    checkGeoPermissionUpfront();
  }

  // Best-effort — the Permissions API isn't universally supported (Safari
  // in particular), so this only ever narrows the window before someone
  // has to tap Start to find out; it never blocks that path. When it *is*
  // available and already denied, showing the real reason immediately —
  // before a tap — beats waiting for watchPosition to fail.
  function checkGeoPermissionUpfront() {
    // The native plugin manages its own Android runtime permission,
    // entirely separate from the WebView's own (often inaccurate inside
    // a native shell) Permissions API — its real flow already runs
    // fresh on every Start tap instead (addWatcher's requestPermissions
    // option), so there's nothing honest to check upfront here.
    if (isNativeBackgroundGeoAvailable()) return;
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'denied') onPositionError({ code: 1, PERMISSION_DENIED: 1 });
      })
      .catch(() => {}); // unsupported query name on some browsers — ignore
  }

  void refreshRunTile();
}

function renderSummary({ distanceMeters, durationMs, avgPaceSecPerKm, calories }, prs, splits, unit) {
  // The final numbers arriving, same kinetic-data language as the rest of
  // the app — animateCountUp interpolates the raw meters/ms/pace and
  // re-formats each frame with the same real formatters used everywhere
  // else, so what's mid-animation is never a fake or rounded-off number.
  animateCountUp(byId('run-summary-distance'), distanceMeters, { formatter: (m) => formatDistanceForUnit(m, unit) });
  animateCountUp(byId('run-summary-duration'), durationMs, { formatter: formatDuration });
  // A run with no measurable distance/time has no pace at all (see
  // calculatePaceSecPerKm) — null, never a fake number to animate toward.
  if (avgPaceSecPerKm == null) {
    byId('run-summary-pace').textContent = formatPaceForUnit(avgPaceSecPerKm, unit);
  } else {
    animateCountUp(byId('run-summary-pace'), avgPaceSecPerKm, { formatter: (p) => formatPaceForUnit(p, unit) });
  }

  // Calories are the one number on this screen this app can't measure —
  // null (no profile weight on file) just hides the row entirely rather
  // than showing a fabricated figure, same honesty as Activity logging's
  // own calorie badge.
  const caloriesRow = byId('run-summary-calories-row');
  caloriesRow.hidden = calories == null;
  if (calories != null) animateCountUp(byId('run-summary-calories'), calories.kcal, { formatter: (k) => `${Math.round(k)} kcal` });

  const badges = [];
  if (prs.isDistancePR) badges.push('New longest run');
  if (prs.isPacePR) badges.push('New fastest pace');
  byId('run-summary-prs').innerHTML = badges
    .map((text) => `<div class="card card-accent row tilt-card tilt-enter" style="align-items:center; gap:var(--space-2);">${iconMarkup('trophy', { size: 18 })}<span>${text}</span></div>`)
    .join('');

  // Splits are the concrete answer to "which part of this run was my
  // fastest" — a real, standard running-app feature this screen didn't
  // have at all before, built from the same recorded points as
  // everything else on it, not a separate estimate.
  const splitsCard = byId('run-summary-splits-card');
  splitsCard.hidden = splits.length === 0;
  renderSplitsList(byId('run-summary-splits'), splits, unit);
}

async function renderHistory() {
  const [runs, profile] = await Promise.all([listAllRuns(), getProfile()]);
  const sorted = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const list = byId('run-history-list');
  const unit = getDistanceUnit();

  if (sorted.length === 0) {
    list.innerHTML = '<p class="muted center-text">No runs logged yet — your first run will show up here.</p>';
    return;
  }

  // Splits and calories are both recomputed fresh from each run's own
  // saved distance/duration/pace here rather than stored on the record —
  // splits because the recorded route is the one source of truth for
  // them, calories because a profile weight can change after the run was
  // logged and this should always reflect the current one, same as
  // Activity logging's own estimate.
  const runsWithSplits = sorted.map((run) => ({
    run,
    splits: computeSplits(run.route ?? [], splitBoundaryMetersForUnit(unit)),
    calories: estimateRunCalories({ durationMs: run.durationMs, avgPaceSecPerKm: run.avgPaceSecPerKm, weightKg: profile?.weightKg }),
  }));

  list.innerHTML = runsWithSplits
    .map(({ run, splits, calories }, index) => {
      const dateLabel = new Date(run.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const splitsId = `run-history-splits-${index}`;
      return `
        <div class="card stack tilt-card tilt-enter">
          <div class="row-between">
            <span class="row" style="gap:10px; align-items:center;">
              <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-wind"></use></svg></span>
              <span>
                <strong>${formatDistanceForUnit(run.distanceMeters, unit)}</strong>
                <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${dateLabel} · ${formatDuration(run.durationMs)}</p>
              </span>
            </span>
            <span class="row" style="gap:6px; align-items:center;">
              ${calories != null ? `<span class="data-badge estimated">${Math.round(calories.kcal)} kcal</span>` : ''}
              <span class="data-badge measured">${formatPaceForUnit(run.avgPaceSecPerKm, unit)}</span>
            </span>
          </div>
          ${
            splits.length > 0
              ? `<details>
                   <summary class="muted" style="font-size:var(--fs-sm); cursor:pointer;">Splits</summary>
                   <div class="stack" id="${splitsId}" style="gap:4px; margin-top:4px;"></div>
                 </details>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  runsWithSplits.forEach(({ splits }, index) => {
    const container = byId(`run-history-splits-${index}`);
    if (container) renderSplitsList(container, splits, unit);
  });
}
