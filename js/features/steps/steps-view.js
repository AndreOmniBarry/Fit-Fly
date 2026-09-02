// Steps: a real, live-counted walk (Generic Sensor API motion sensing —
// see motion-steps.js) or manual entry for a full day's total. No passive
// background pedometer — this web app has no way to keep counting once
// the tab isn't the active, foregrounded page, and the screen says so
// plainly, the same "no true passive sensing" honesty as Sleep.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { getPref, setPref } from '../../lib/storage.js';
import { setStepsTileSubtitle } from '../hub/hub-view.js';
import { isMotionSensingAvailable, startStepCounting } from './motion-steps.js';
import { addStepsToDate, getStepEntryForDate, listRecentStepEntries, setStepsForDate } from '../../db/repositories/steps.js';
import { averageStepsPerLoggedDay, calculateStepsStreak } from './steps-trend.js';
const DEFAULT_GOAL = 7500;
const GOAL_PREF_KEY = 'stepsGoal';
// Matches .steps-goal-ring-fill's r=86 in index.html/mini-apps.css.
const RING_CIRCUMFERENCE = 2 * Math.PI * 86;
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`steps-view: missing #${id}`);
    return el;
}
function getGoal() {
    const stored = Number(getPref(GOAL_PREF_KEY, String(DEFAULT_GOAL)));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_GOAL;
}
export function initStepsFeature() {
    let liveSession = null;
    let liveSessionSteps = 0;
    const stepsScreen = byId('screen-steps');
    const tilt = attachTilt(stepsScreen);
    stepsScreen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    byId('steps-goal-input').setAttribute('placeholder', String(getGoal()));
    // ---------- live walk ----------
    if (isMotionSensingAvailable()) {
        byId('steps-live-status').textContent = 'Start a walk to count real steps live, right here on this screen.';
    }
    else {
        byId('steps-live-status').textContent =
            "This browser doesn't support live motion sensing — log today's total manually instead.";
        byId('btn-steps-live-toggle').disabled = true;
    }
    byId('btn-steps-live-toggle').addEventListener('click', () => {
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
    // ---------- manual entry ----------
    byId('btn-steps-manual-save').addEventListener('click', async () => {
        const steps = Number(byId('steps-manual-count').value);
        const valid = Number.isInteger(steps) && steps >= 0 && steps <= 100_000;
        byId('err-steps-manual').hidden = valid;
        if (!valid)
            return;
        await setStepsForDate(steps);
        byId('steps-manual-count').value = '';
        await refreshAll();
    });
    // ---------- daily goal ----------
    byId('btn-steps-goal-save').addEventListener('click', () => {
        const goal = Number(byId('steps-goal-input').value);
        if (!Number.isFinite(goal) || goal < 1000 || goal > 50_000)
            return;
        setPref(GOAL_PREF_KEY, String(goal));
        byId('steps-goal-input').value = '';
        byId('steps-goal-input').setAttribute('placeholder', String(goal));
        void refreshAll();
    });
    byId('btn-steps-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-steps').addEventListener('click', () => {
        void refreshAll();
    });
    void refreshAll();
}
async function refreshAll() {
    const [today, recent] = await Promise.all([getStepEntryForDate(), listRecentStepEntries(30)]);
    renderRing(today);
    renderHistory(recent);
    renderStats(recent);
}
function renderRing(today) {
    const steps = today?.steps ?? 0;
    const goal = getGoal();
    const fraction = Math.max(0, Math.min(1, steps / goal));
    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    animateCountUp(byId('steps-today-count'), steps);
    byId('steps-goal-ring-fill').setAttribute('stroke-dashoffset', offset.toFixed(2));
    byId('steps-goal-label').textContent = `of ${goal.toLocaleString()} goal`;
}
function renderStats(recent) {
    const streak = calculateStepsStreak(recent);
    const avg = averageStepsPerLoggedDay(recent, 7);
    animateCountUp(byId('steps-stat-streak'), streak);
    animateCountUp(byId('steps-stat-avg'), avg);
    setStepsTileSubtitle(streak > 0 ? `${streak}-day streak` : 'Count a real walk');
}
function renderHistory(recent) {
    const list = byId('steps-history-list');
    if (recent.length === 0) {
        list.innerHTML = '<p class="muted center-text">No days logged yet.</p>';
        return;
    }
    const sourceLabel = { manual: 'Manual', sensor: 'Live-counted' };
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
//# sourceMappingURL=steps-view.js.map