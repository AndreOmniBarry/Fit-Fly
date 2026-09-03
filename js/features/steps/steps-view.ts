// Steps: on the plain web, a real live-counted walk (Generic Sensor API
// motion sensing — see motion-steps.js) or manual entry for a full day's
// total — no passive background pedometer, since a browser tab has no
// way to keep counting once it isn't the active, foregrounded page.
// Wrapped natively via Capacitor (see native-pedometer.js), this screen
// instead drives a real foreground-service-backed background pedometer
// that keeps counting through a locked screen — js/lib/native-runtime.js
// is the seam, provably false in every browser context today.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { getPref, setPref } from '../../lib/storage.js';
import { setStepsTileSubtitle } from '../hub/hub-view.js';
import { isMotionSensingAvailable, startStepCounting } from './motion-steps.js';
import {
  getNativeStepPermission,
  getNativeTodayStepCount,
  isNativeStepCounterAvailable,
  onNativeStepCountChanged,
  requestNativeStepPermission,
  startNativeBackgroundStepCounting,
  stopNativeBackgroundStepCounting,
} from './native-pedometer.js';
import {
  addStepsToDate,
  getStepEntryForDate,
  listAllStepEntries,
  listRecentStepEntries,
  setStepsForDate,
  syncStepsFromNativePedometer,
} from '../../db/repositories/steps.js';
import { averageStepsPerLoggedDay, bestStepsDayEver, calculateStepsStreak } from './steps-trend.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import type { StepEntry } from '../../db/repositories/steps.js';

const DEFAULT_GOAL = 7500;
const GOAL_PREF_KEY = 'stepsGoal';
// Matches .steps-goal-ring-fill's r=86 in index.html/mini-apps.css.
const RING_CIRCUMFERENCE = 2 * Math.PI * 86;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`steps-view: missing #${id}`);
  return el as T;
}

function getGoal(): number {
  const stored = Number(getPref(GOAL_PREF_KEY, String(DEFAULT_GOAL)));
  return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_GOAL;
}

export function initStepsFeature(): void {
  let liveSession: { stop: () => void } | null = null;
  let liveSessionSteps = 0;

  const stepsScreen = byId('screen-steps');
  const tilt = attachTilt(stepsScreen);
  stepsScreen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });

  byId('steps-goal-input').setAttribute('placeholder', String(getGoal()));

  byId('steps-background-note-text').textContent = isNativeStepCounterAvailable()
    ? 'Once background counting is turned on below, this device keeps counting your real steps even with the screen locked or the app closed — the same architecture Run mode\'s own background GPS uses.'
    : "A live walk only counts steps while this screen stays open and active — there's no passive, background pedometer here (this web app has no way to keep running once you switch apps or lock your phone). For a full day's real total, log it manually from your phone's own step count.";

  // ---------- live walk (web) / background counting (native) ----------
  if (isNativeStepCounterAvailable()) {
    void initNativeBackgroundCounting();
  } else if (isMotionSensingAvailable()) {
    byId('steps-live-status').textContent = 'Start a walk to count real steps live, right here on this screen.';
  } else {
    byId('steps-live-status').textContent =
      "This browser doesn't support live motion sensing — log today's total manually instead.";
    byId<HTMLButtonElement>('btn-steps-live-toggle').disabled = true;
  }

  byId('btn-steps-live-toggle').addEventListener('click', () => {
    if (isNativeStepCounterAvailable()) {
      void toggleNativeBackgroundCounting();
      return;
    }

    if (liveSession) {
      liveSession.stop();
      liveSession = null;
      byId('steps-live-active').hidden = true;
      byId('btn-steps-live-toggle').textContent = 'Start a Walk';
      if (liveSessionSteps > 0) {
        void addStepsToDate(liveSessionSteps).then(() => {
          liveSessionSteps = 0;
          void refreshAll();
        });
      }
      return;
    }

    liveSessionSteps = 0;
    byId('steps-live-count').textContent = '0 steps this walk';
    byId('steps-live-active').hidden = false;
    byId('btn-steps-live-toggle').textContent = 'Stop Walk';
    liveSession = startStepCounting({
      onStepCount: (count) => {
        liveSessionSteps = count;
        byId('steps-live-count').textContent = `${count} step${count === 1 ? '' : 's'} this walk`;
      },
      onError: (error) => {
        byId('steps-live-status').textContent = error.message;
        byId('steps-live-active').hidden = true;
        byId('btn-steps-live-toggle').textContent = 'Start a Walk';
        liveSession = null;
      },
    });
  });

  // ---------- native background counting ----------
  // Every native call below is wrapped so a real plugin failure (a
  // native build that isn't fully wired yet, a permission API glitch,
  // ...) degrades to an honest status message instead of an unhandled
  // rejection breaking the screen silently — the same "feature-detected
  // API, never lets a failure throw uncaught into the app" contract as
  // every other sensor integration here.
  let nativeBackgroundActive = false;

  async function refreshNativeStatusText(): Promise<void> {
    try {
      const permission = await getNativeStepPermission();
      if (permission === 'denied') {
        byId('steps-live-status').textContent =
          'Background step counting is blocked — enable it in your phone\'s app permissions to count steps while your screen is locked.';
      } else if (nativeBackgroundActive) {
        byId('steps-live-status').textContent =
          'Fit Fly is counting your real steps in the background — this keeps working even with your screen locked.';
      } else {
        byId('steps-live-status').textContent =
          'Turn on background counting to keep a real step count going even while your screen is locked.';
      }
    } catch {
      byId('steps-live-status').textContent = "Couldn't reach this device's step counter — log today's total manually instead.";
      byId<HTMLButtonElement>('btn-steps-live-toggle').disabled = true;
    }
  }

  async function initNativeBackgroundCounting(): Promise<void> {
    await refreshNativeStatusText();

    try {
      // A live "steps so far today" readout on top of the real
      // background persistence — see native-pedometer.js's own comment
      // on why this only matters while the screen happens to be on
      // anyway. Never unsubscribed: this screen's own controller is
      // initialized once at app bootstrap and lives for the whole
      // session, same as every other mini-app here.
      onNativeStepCountChanged((steps) => {
        byId('steps-live-count').textContent = `${steps.toLocaleString()} step${steps === 1 ? '' : 's'} today (background)`;
        void syncStepsFromNativePedometer(steps).then(() => refreshAll());
      });

      // Reflects whatever the background service already persisted
      // today — including steps taken before this screen was ever
      // opened, the actual "worked while locked" payoff.
      const { steps, hasReading } = await getNativeTodayStepCount();
      if (hasReading) {
        byId('steps-live-active').hidden = false;
        byId('steps-live-count').textContent = `${steps.toLocaleString()} step${steps === 1 ? '' : 's'} today (background)`;
        void syncStepsFromNativePedometer(steps).then(() => refreshAll());
      }
    } catch {
      // Already reported by refreshNativeStatusText() above if this is
      // the same underlying failure; nothing further to show.
    }
  }

  async function toggleNativeBackgroundCounting(): Promise<void> {
    try {
      if (nativeBackgroundActive) {
        await stopNativeBackgroundStepCounting();
        nativeBackgroundActive = false;
        byId('steps-live-active').hidden = true;
        byId('btn-steps-live-toggle').textContent = 'Turn On Background Counting';
        await refreshNativeStatusText();
        return;
      }

      const permission = await requestNativeStepPermission();
      if (permission !== 'granted') {
        await refreshNativeStatusText();
        return;
      }

      await startNativeBackgroundStepCounting();
      nativeBackgroundActive = true;
      byId('steps-live-active').hidden = false;
      byId('btn-steps-live-toggle').textContent = 'Turn Off Background Counting';
      await refreshNativeStatusText();
    } catch {
      byId('steps-live-status').textContent = "Couldn't reach this device's step counter — log today's total manually instead.";
    }
  }

  // ---------- manual entry ----------
  byId('btn-steps-manual-save').addEventListener('click', async () => {
    const steps = Number(byId<HTMLInputElement>('steps-manual-count').value);
    const valid = Number.isInteger(steps) && steps >= 0 && steps <= 100_000;
    byId('err-steps-manual').hidden = valid;
    if (!valid) return;

    await setStepsForDate(steps);
    byId<HTMLInputElement>('steps-manual-count').value = '';
    await refreshAll();
  });

  // ---------- daily goal ----------
  byId('btn-steps-goal-save').addEventListener('click', () => {
    const goal = Number(byId<HTMLInputElement>('steps-goal-input').value);
    if (!Number.isFinite(goal) || goal < 1000 || goal > 50_000) return;
    setPref(GOAL_PREF_KEY, String(goal));
    byId<HTMLInputElement>('steps-goal-input').value = '';
    byId('steps-goal-input').setAttribute('placeholder', String(goal));
    void refreshAll();
  });

  byId('btn-steps-back').addEventListener('click', () => showScreen('screen-hub'));

  byId('btn-home-steps').addEventListener('click', () => {
    void refreshAll();
  });

  void refreshAll();
}

async function refreshAll(): Promise<void> {
  const [today, recent, all] = await Promise.all([
    getStepEntryForDate(),
    listRecentStepEntries(30),
    listAllStepEntries(),
  ]);

  renderRing(today);
  renderHistory(recent);
  renderStats(recent);
  renderTrend(recent, all);
}

function renderRing(today: StepEntry | undefined): void {
  const steps = today?.steps ?? 0;
  const goal = getGoal();
  const fraction = Math.max(0, Math.min(1, steps / goal));
  const offset = RING_CIRCUMFERENCE * (1 - fraction);

  animateCountUp(byId('steps-today-count'), steps);
  byId('steps-goal-ring-fill').setAttribute('stroke-dashoffset', offset.toFixed(2));
  byId('steps-goal-label').textContent = `of ${goal.toLocaleString()} goal`;
}

function renderStats(recent: StepEntry[]): void {
  const streak = calculateStepsStreak(recent);
  const avg = averageStepsPerLoggedDay(recent, 7);

  animateCountUp(byId('steps-stat-streak'), streak);
  animateCountUp(byId('steps-stat-avg'), avg);

  setStepsTileSubtitle(streak > 0 ? `${streak}-day streak` : 'Count a real walk');
}

/** 14-day bar trend + a real "best day ever" badge — a personal best
 *  drawn from the whole logged history (`all`), never just the visible
 *  window, same "a real record, not a recent-window illusion" contract
 *  as Run's own PR badges. */
function renderTrend(recent: StepEntry[], all: StepEntry[]): void {
  const goal = getGoal();
  const window = [...recent].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

  renderTrendChart(byId('steps-trend-chart'), {
    points: window.map((entry) => ({
      key: entry.date,
      value: entry.steps,
      axisLabel: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }),
      highlighted: entry.steps >= goal,
      tooltipValue: `${entry.steps.toLocaleString()} steps`,
      tooltipDetail: `${new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${entry.steps >= goal ? ' · Goal met' : ''}`,
    })),
    accentVar: '--steps-accent',
    referenceValue: goal,
    emptyMessage: 'Log a second day to start a trend.',
  });

  const bestDay = bestStepsDayEver([...all].sort((a, b) => a.date.localeCompare(b.date)));
  const badge = byId('steps-best-day-badge');
  if (bestDay) {
    const dateLabel = new Date(`${bestDay.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    byId('steps-best-day-text').textContent = `Best: ${bestDay.steps.toLocaleString()} on ${dateLabel}`;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderHistory(recent: StepEntry[]): void {
  const list = byId('steps-history-list');
  if (recent.length === 0) {
    list.innerHTML = '<p class="muted center-text">No days logged yet.</p>';
    return;
  }
  const sourceLabel: Record<'manual' | 'sensor' | 'native-pedometer', string> = {
    manual: 'Manual',
    sensor: 'Live-counted',
    'native-pedometer': 'Background',
  };
  list.innerHTML = recent
    .map((entry) => {
      const dateLabel = new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      return `
        <div class="steps-card row-between tilt-card tilt-enter">
          <span>
            <strong>${entry.steps.toLocaleString()} steps</strong>
            <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${sourceLabel[entry.source]} · ${dateLabel}</p>
          </span>
        </div>
      `;
    })
    .join('');
}
