// Hydration: a real running total for today, drawn as a human figure
// that fills with water — the fill's y/height are set from the actual
// ml logged vs. the daily goal, the same "real attribute drives the
// data, CSS only eases it" language as Sleep's score ring and Steps'
// goal ring. The little scrolling wave riding the surface is the one
// purely decorative touch (see mini-apps.css) — it never encodes data
// itself, just tracks the fill's real top edge.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { getPref, setPref } from '../../lib/storage.js';
import { getNotificationPermission, requestNotificationPermission, showNotification } from '../../lib/notifications.js';
import { setHydrationTileSubtitle } from '../hub/hub-view.js';
import { hydrationNeedsReminder } from './hydration-reminders.js';
import { averageHydrationPerLoggedDay, bestHydrationDayEver, calculateHydrationStreak, groupHydrationByDate, } from './hydration-trend.js';
import { addHydrationEntry, listAllHydrationEntries, listHydrationEntriesForDate, listRecentHydrationEntries, sumHydrationEntries, } from '../../db/repositories/hydration.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
const DEFAULT_GOAL_ML = 2200;
const GOAL_PREF_KEY = 'hydrationGoalMl';
const DEFAULT_INTERVAL_HOURS = 2;
const INTERVAL_PREF_KEY = 'hydrationReminderIntervalHours';
const LAST_REMINDER_PREF_KEY = 'lastHydrationReminderAt';
const HOUR_MS = 60 * 60 * 1000;
// Matches the figure's viewBox="0 0 100 170" in index.html: roughly the
// top of the head to the feet, so the water genuinely rises through the
// body rather than the whole 0-170 box (which includes empty margin).
const FIGURE_TOP_Y = 8;
const FIGURE_BOTTOM_Y = 170;
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`hydration-view: missing #${id}`);
    return el;
}
function getGoalMl() {
    const stored = Number(getPref(GOAL_PREF_KEY, String(DEFAULT_GOAL_ML)));
    return Number.isFinite(stored) && stored >= 500 ? stored : DEFAULT_GOAL_ML;
}
function getReminderIntervalHours() {
    const stored = Number(getPref(INTERVAL_PREF_KEY, String(DEFAULT_INTERVAL_HOURS)));
    return Number.isFinite(stored) && stored >= 1 ? stored : DEFAULT_INTERVAL_HOURS;
}
export function initHydrationFeature() {
    const hydrationScreen = byId('screen-hydration');
    const tilt = attachTilt(hydrationScreen);
    hydrationScreen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    byId('hydration-goal-input').setAttribute('placeholder', String(getGoalMl()));
    byId('hydration-interval-hours').value = String(getReminderIntervalHours());
    // ---------- quick log ----------
    byId('hydration-quick-log').querySelectorAll('.hydration-quick-log-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const amountMl = Number(btn.dataset.ml);
            if (!Number.isFinite(amountMl) || amountMl <= 0)
                return;
            await addHydrationEntry({ amountMl });
            await refreshAll();
        });
    });
    byId('btn-hydration-custom-save').addEventListener('click', async () => {
        const amountMl = Number(byId('hydration-custom-ml').value);
        const valid = Number.isFinite(amountMl) && amountMl >= 1 && amountMl <= 5000;
        byId('err-hydration-custom').hidden = valid;
        if (!valid)
            return;
        await addHydrationEntry({ amountMl });
        byId('hydration-custom-ml').value = '';
        await refreshAll();
    });
    // ---------- daily goal ----------
    byId('btn-hydration-goal-save').addEventListener('click', () => {
        const goal = Number(byId('hydration-goal-input').value);
        if (!Number.isFinite(goal) || goal < 500 || goal > 6000)
            return;
        setPref(GOAL_PREF_KEY, String(goal));
        byId('hydration-goal-input').value = '';
        byId('hydration-goal-input').setAttribute('placeholder', String(goal));
        void refreshAll();
    });
    // ---------- reminders ----------
    renderNotifyStatus();
    byId('btn-hydration-enable-notify').addEventListener('click', async () => {
        await requestNotificationPermission();
        renderNotifyStatus();
    });
    byId('hydration-interval-hours').addEventListener('change', (event) => {
        const hours = Number(event.target.value);
        if (!Number.isFinite(hours) || hours < 1 || hours > 8)
            return;
        setPref(INTERVAL_PREF_KEY, String(hours));
    });
    byId('btn-hydration-back').addEventListener('click', () => showScreen('screen-hub'));
    byId('btn-home-hydration').addEventListener('click', () => {
        renderNotifyStatus();
        void refreshAll();
        void checkHydrationReminders();
    });
    void refreshAll();
    void checkHydrationReminders();
}
function renderNotifyStatus() {
    const permission = getNotificationPermission();
    const statusText = {
        unsupported: 'Not supported in this browser.',
        granted: "Enabled — you'll get a reminder if you fall behind.",
        denied: "Blocked — you can re-enable this in your browser's site settings.",
        default: 'Not enabled yet.',
    };
    byId('hydration-notify-status').textContent = statusText[permission];
    byId('btn-hydration-enable-notify').hidden = permission !== 'default';
    byId('hydration-interval-row').hidden = permission !== 'granted';
}
/** The honest version of a hydration reminder without a push server:
 *  checked whenever the screen opens (and once at startup), fires a real
 *  notification only if it's already been granted, the configured
 *  interval has actually passed since the last one, and today's goal
 *  hasn't already been hit — never nags once you're done for the day. */
async function checkHydrationReminders() {
    if (getNotificationPermission() !== 'granted')
        return;
    const intervalMs = getReminderIntervalHours() * HOUR_MS;
    const lastReminderAt = getPref(LAST_REMINDER_PREF_KEY, '');
    if (!hydrationNeedsReminder(lastReminderAt || null, Date.now(), intervalMs))
        return;
    const todayEntries = await listHydrationEntriesForDate();
    const todayMl = sumHydrationEntries(todayEntries);
    if (todayMl >= getGoalMl())
        return;
    setPref(LAST_REMINDER_PREF_KEY, new Date().toISOString());
    showNotification('Time for some water', {
        body: todayMl > 0 ? `${todayMl}ml logged so far today — keep going.` : "You haven't logged a drink yet today.",
    });
}
async function refreshAll() {
    const [todayEntries, recent, all] = await Promise.all([
        listHydrationEntriesForDate(),
        listRecentHydrationEntries(500),
        listAllHydrationEntries(),
    ]);
    renderFigure(sumHydrationEntries(todayEntries));
    renderStats(recent);
    renderHistory(todayEntries);
    renderTrend(recent, all);
}
function renderFigure(todayMl) {
    const goal = getGoalMl();
    const fraction = Math.max(0, Math.min(1, todayMl / goal));
    const range = FIGURE_BOTTOM_Y - FIGURE_TOP_Y;
    const fillHeight = fraction * range;
    const fillY = FIGURE_BOTTOM_Y - fillHeight;
    byId('hydration-water-fill').setAttribute('y', fillY.toFixed(2));
    byId('hydration-water-fill').setAttribute('height', fillHeight.toFixed(2));
    byId('hydration-wave-position').style.transform = `translateY(${(fillY - 8).toFixed(2)}px)`;
    animateCountUp(byId('hydration-today-ml'), todayMl, { formatter: (n) => Math.round(n).toLocaleString() });
    byId('hydration-goal-label').textContent = `of ${goal.toLocaleString()}ml goal`;
}
function renderStats(recent) {
    const streak = calculateHydrationStreak(recent);
    const avg = averageHydrationPerLoggedDay(recent, 7);
    animateCountUp(byId('hydration-stat-streak'), streak);
    animateCountUp(byId('hydration-stat-avg'), avg);
    setHydrationTileSubtitle(streak > 0 ? `${streak}-day streak` : 'Log a drink');
}
/** 14-day bar trend + a real "best day ever" badge — a personal best
 *  drawn from the whole logged history (`all`), never just the visible
 *  window, same "a real record, not a recent-window illusion" contract
 *  as Run's own PR badges. */
function renderTrend(recent, all) {
    const goal = getGoalMl();
    const todayIso = new Date().toISOString().slice(0, 10);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 13);
    const windowStartIso = windowStart.toISOString().slice(0, 10);
    const dailyTotals = groupHydrationByDate(recent.filter((e) => e.date >= windowStartIso && e.date <= todayIso));
    const days = [...dailyTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
    renderTrendChart(byId('hydration-trend-chart'), {
        points: days.map(([date, amountMl]) => ({
            key: date,
            value: amountMl,
            axisLabel: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }),
            highlighted: amountMl >= goal,
            tooltipValue: `${amountMl.toLocaleString()}ml`,
            tooltipDetail: `${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${amountMl >= goal ? ' · Goal met' : ''}`,
        })),
        accentVar: '--hydration-accent',
        referenceValue: goal,
        emptyMessage: 'Log a second day to start a trend.',
    });
    const bestDay = bestHydrationDayEver([...all].sort((a, b) => a.date.localeCompare(b.date)));
    const badge = byId('hydration-best-day-badge');
    if (bestDay) {
        const dateLabel = new Date(`${bestDay.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        byId('hydration-best-day-text').textContent = `Best: ${bestDay.amountMl.toLocaleString()}ml on ${dateLabel}`;
        badge.hidden = false;
    }
    else {
        badge.hidden = true;
    }
}
function renderHistory(todayEntries) {
    const list = byId('hydration-history-list');
    if (todayEntries.length === 0) {
        list.innerHTML = '<p class="muted center-text">No drinks logged yet today.</p>';
        return;
    }
    list.innerHTML = [...todayEntries]
        .reverse() // newest first
        .map((entry) => {
        const timeLabel = new Date(entry.loggedAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        });
        return `
        <div class="hydration-card row-between tilt-card tilt-enter">
          <strong>${entry.amountMl.toLocaleString()}ml</strong>
          <span class="muted" style="font-size:var(--fs-sm);">${timeLabel}</span>
        </div>
      `;
    })
        .join('');
}
//# sourceMappingURL=hydration-view.js.map