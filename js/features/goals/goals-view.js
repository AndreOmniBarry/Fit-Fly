import { showScreen } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { escapeHtml } from '../../lib/html.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { getPref, setPref } from '../../lib/storage.js';
import { getNotificationPermission, requestNotificationPermission, showNotification } from '../../lib/notifications.js';
import { calculateStreak } from '../../lib/streak.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import { calculateProgressPercent, daysUntilDeadline, isGoalAchieved, remainingToTarget } from './goal-progress.js';
import { newlyCrossedMilestones } from './milestones.js';
import { inferActivityType } from './goal-activity.js';
import { pickMilestoneMessage } from './goal-phrases.js';
import { buildGoalsNotification } from './reminders.js';
import { createGoal, listActiveGoals, logGoalProgress, markGoalAchieved } from '../../db/repositories/goals.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** The dates progress was actually logged for this goal, oldest first —
 *  the one real signal every streak/trend read here comes from. */
function loggedDates(goal) {
  return (goal.history ?? []).map((entry) => entry.loggedAt.slice(0, 10));
}

// A milestone just crossed shows once, on the very next render, then
// clears itself — a real one-time celebration, not a badge that lingers
// forever once earned. Stores the already-picked message text (not just
// the threshold number) so the card and the notification that fired
// alongside it always read identically.
const pendingMilestoneByGoalId = new Map();

export function initGoalsFeature() {
  const directionChips = initChipGroup(byId('goal-direction'), { initial: 'increase' });

  // Same spatial-tilt language as the rest of the Fitness Toolkit.
  const goalsScreen = byId('screen-goals');
  const goalsTilt = attachTilt(goalsScreen);
  goalsScreen.addEventListener('pointerdown', () => void goalsTilt.requestMotionPermission(), { once: true });

  byId('btn-home-goals').addEventListener('click', async () => {
    renderNotifyStatus();
    await renderGoals();
    showScreen('screen-goals');
  });
  byId('btn-goals-back').addEventListener('click', () => showScreen('screen-home'));

  byId('btn-goals-enable-notify').addEventListener('click', async () => {
    await requestNotificationPermission();
    renderNotifyStatus();
  });

  byId('btn-goal-create').addEventListener('click', async () => {
    const name = byId('goal-name').value.trim();
    const targetValue = Number(byId('goal-target').value);
    const startValue = Number(byId('goal-start').value);
    const valid = name.length > 0 && Number.isFinite(targetValue) && byId('goal-start').value !== '';
    byId('err-goal').hidden = valid;
    if (!valid) return;

    await createGoal({
      name,
      unit: byId('goal-unit').value.trim(),
      direction: directionChips.getValue(),
      targetValue,
      startValue,
      currentValue: startValue,
      deadline: byId('goal-deadline').value || null,
    });

    for (const id of ['goal-name', 'goal-target', 'goal-unit', 'goal-start', 'goal-deadline']) {
      byId(id).value = '';
    }
    directionChips.setValue('increase');
    await renderGoals();
  });

  // A real, activity-flavored nudge — "time to smash your walk streak",
  // not one generic line for every goal — the honest version of a
  // reminder without a push server (see reminders.js's own comment).
  // Priority (a real streak at risk, then real close-to-target progress,
  // then the plain "hasn't logged today" case) all lives in
  // buildGoalsNotification, over real goals and real history only. Never
  // prompts for permission on its own — only fires if it's already
  // granted — and at most once per calendar day even across reloads,
  // tracked via a persisted pref rather than in-memory, so refreshing
  // the page doesn't re-trigger it.
  void checkGoalReminders();
}

async function checkGoalReminders() {
  if (getNotificationPermission() !== 'granted') return;

  const today = todayIsoDate();
  if (getPref('lastGoalsReminderDate') === today) return;

  const goals = await listActiveGoals();
  const notification = buildGoalsNotification(goals, today);
  if (!notification) return;

  setPref('lastGoalsReminderDate', today);
  showNotification(notification.title, { body: notification.body });
}

function renderNotifyStatus() {
  const permission = getNotificationPermission();
  const statusText = {
    unsupported: 'Not supported in this browser.',
    granted: 'Enabled — you\'ll get notified when you hit a goal.',
    denied: 'Blocked — you can re-enable this in your browser\'s site settings.',
    default: 'Not enabled yet.',
  }[permission];
  byId('goals-notify-status').textContent = statusText;
  byId('btn-goals-enable-notify').hidden = permission !== 'default';
}

async function renderGoals() {
  const goals = await listActiveGoals();
  const list = byId('goals-list');

  if (goals.length === 0) {
    list.innerHTML = '<p class="muted center-text">No active goals yet — add one below.</p>';
    return;
  }

  list.innerHTML = goals.map(renderGoalCard).join('');

  goals.forEach((goal) => {
    const percentEl = list.querySelector(`[data-percent-for="${goal.id}"]`);
    if (percentEl) animateCountUp(percentEl, Math.round(calculateProgressPercent(goal)), { formatter: (n) => `${Math.round(n)}%` });

    // A real trend of every logged update for this goal, reusing the
    // exact same shared bar chart Steps/Hydration/Run already use (see
    // js/lib/trend-chart.js) rather than a bespoke chart just for Goals
    // — with the target drawn in as the chart's own reference line, so
    // "how close am I" is a picture, not just a percentage.
    const chartContainer = list.querySelector(`[data-history-for="${goal.id}"]`);
    if (chartContainer) {
      renderTrendChart(chartContainer, {
        points: goalHistoryChartPoints(goal),
        accentVar: '--accent',
        referenceValue: goal.targetValue,
        emptyMessage: 'Log progress twice to see a trend.',
      });
    }
  });

  list.querySelectorAll('[data-log-progress-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const goalId = btn.dataset.logProgressId;
      const input = list.querySelector(`[data-progress-input="${goalId}"]`);
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      await applyProgressUpdate(goalId, value);
      input.value = '';
      await renderGoals();
    });
  });
}

function goalHistoryChartPoints(goal) {
  return (goal.history ?? []).map((entry, index) => {
    const date = new Date(entry.loggedAt);
    const achievedAtThisPoint = isGoalAchieved({
      direction: goal.direction,
      currentValue: entry.value,
      targetValue: goal.targetValue,
    });
    return {
      key: `${goal.id}-${index}`,
      value: entry.value,
      axisLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      highlighted: achievedAtThisPoint,
      tooltipValue: `${entry.value}${goal.unit}`,
      tooltipDetail: `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${achievedAtThisPoint ? ' · Goal met' : ''}`,
    };
  });
}

async function applyProgressUpdate(goalId, currentValue) {
  const before = await logGoalProgressAndGetPrevious(goalId, currentValue);
  const { previousGoal, goal } = before;

  if (isGoalAchieved(goal)) {
    await markGoalAchieved(goalId);
    showNotification('Goal achieved!', { body: goal.name });
    return;
  }

  const previousPercent = calculateProgressPercent(previousGoal);
  const currentPercent = calculateProgressPercent(goal);
  const crossed = newlyCrossedMilestones(previousPercent, currentPercent);
  if (crossed.length > 0) {
    const milestone = crossed[crossed.length - 1]; // the highest one reached in this single update
    const message = pickMilestoneMessage(inferActivityType(goal), milestone);
    pendingMilestoneByGoalId.set(goalId, message);
    showNotification('Nice progress!', { body: `${goal.name}: ${message}` });
  }
}

/** logGoalProgress overwrites currentValue in place, so the "before"
 *  state has to be captured first — needed to compute the percent this
 *  update moved *from*, not just where it ended up. */
async function logGoalProgressAndGetPrevious(goalId, currentValue) {
  const goals = await listActiveGoals();
  const previousGoal = goals.find((g) => g.id === goalId);
  const goal = await logGoalProgress(goalId, currentValue);
  return { previousGoal, goal };
}

function renderGoalCard(goal) {
  const percent = Math.round(calculateProgressPercent(goal));
  const days = daysUntilDeadline(goal.deadline);
  const deadlineText =
    days == null ? '' : days >= 0 ? `${days} day(s) left` : `${Math.abs(days)} day(s) past deadline`;

  const streak = calculateStreak(loggedDates(goal));
  const remaining = remainingToTarget(goal);
  const closeText = remaining > 0 ? `${remaining}${escapeHtml(goal.unit)} to go` : 'Right at your target';

  const milestoneMessage = pendingMilestoneByGoalId.get(goal.id);
  pendingMilestoneByGoalId.delete(goal.id); // shown at most once

  const history = goal.history ?? [];

  return `
    <div class="card stack tilt-card tilt-enter">
      <span class="tilt-press stack">
        <div class="row-between">
          <span class="row" style="gap:10px; align-items:center; flex-wrap:wrap;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="18" height="18" viewBox="0 0 24 24"><use href="#icon-target"></use></svg></span>
            <strong>${escapeHtml(goal.name)}</strong>
            ${
              streak >= 2
                ? `<span class="row" style="gap:3px; align-items:center; font-size:var(--fs-xs); font-weight:700;"><svg class="icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-flame"></use></svg>${streak}-day streak</span>`
                : ''
            }
          </span>
          <span class="muted" style="font-size:var(--fs-sm);">${deadlineText}</span>
        </div>
        ${
          milestoneMessage
            ? `<div class="card card-accent row" style="align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3);">
                 <svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-party"></use></svg>
                 <span style="font-size:var(--fs-sm);">${escapeHtml(milestoneMessage)}</span>
               </div>`
            : ''
        }
        <div class="goal-progress-track" data-tilt-depth="1">
          <div class="goal-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="row-between" style="font-size:var(--fs-sm);">
          <span class="muted">${goal.currentValue}${escapeHtml(goal.unit)} of ${goal.targetValue}${escapeHtml(goal.unit)} · ${closeText}</span>
          <span class="muted" data-percent-for="${goal.id}">${percent}%</span>
        </div>
        ${history.length > 0 ? `<div class="trend-chart" data-history-for="${goal.id}"></div>` : ''}
        <div class="row">
          <input class="input" type="number" step="any" data-progress-input="${goal.id}" placeholder="Update value">
          <button class="btn btn-secondary" data-log-progress-id="${goal.id}">Log</button>
        </div>
      </span>
    </div>
  `;
}
