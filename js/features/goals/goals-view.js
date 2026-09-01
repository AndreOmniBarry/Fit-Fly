import { showScreen } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { escapeHtml } from '../../lib/html.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { getPref, setPref } from '../../lib/storage.js';
import { getNotificationPermission, requestNotificationPermission, showNotification } from '../../lib/notifications.js';
import { calculateProgressPercent, daysUntilDeadline, isGoalAchieved } from './goal-progress.js';
import { MILESTONE_MESSAGES, newlyCrossedMilestones } from './milestones.js';
import { goalsNeedingTodaysNudge } from './reminders.js';
import { createGoal, listActiveGoals, logGoalProgress, markGoalAchieved } from '../../db/repositories/goals.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// A milestone just crossed shows once, on the very next render, then
// clears itself — a real one-time celebration, not a badge that lingers
// forever once earned.
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

  // "Time to smash your goals today" — a real check-on-open nudge, the
  // honest version of a reminder without a push server (see
  // reminders.js's own comment). Never prompts for permission on its
  // own — only fires if it's already granted — and at most once per
  // calendar day even across reloads, tracked via a persisted pref
  // rather than in-memory, so refreshing the page doesn't re-trigger it.
  void checkGoalReminders();
}

async function checkGoalReminders() {
  if (getNotificationPermission() !== 'granted') return;

  const today = todayIsoDate();
  if (getPref('lastGoalsReminderDate') === today) return;

  const goals = await listActiveGoals();
  const needingNudge = goalsNeedingTodaysNudge(goals, today);
  if (needingNudge.length === 0) return;

  setPref('lastGoalsReminderDate', today);
  showNotification('Time to smash your goals today', {
    body:
      needingNudge.length === 1
        ? needingNudge[0].name
        : `${needingNudge.length} goals could use an update: ${needingNudge.map((g) => g.name).join(', ')}`,
  });
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
  });

  list.querySelectorAll('[data-log-progress-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const goalId = btn.dataset.logProgressId;
      const input = list.querySelector(`[data-progress-input="${goalId}"]`);
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      await applyProgressUpdate(goalId, value);
      await renderGoals();
    });
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
    pendingMilestoneByGoalId.set(goalId, milestone);
    showNotification('Nice progress!', { body: `${goal.name}: ${MILESTONE_MESSAGES[milestone]}` });
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

  const milestone = pendingMilestoneByGoalId.get(goal.id);
  pendingMilestoneByGoalId.delete(goal.id); // shown at most once

  return `
    <div class="card stack tilt-card tilt-enter">
      <span class="tilt-press stack">
        <div class="row-between">
          <span class="row" style="gap:10px;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="18" height="18" viewBox="0 0 24 24"><use href="#icon-target"></use></svg></span>
            <strong>${escapeHtml(goal.name)}</strong>
          </span>
          <span class="muted" style="font-size:var(--fs-sm);">${deadlineText}</span>
        </div>
        ${
          milestone
            ? `<div class="card card-accent row" style="align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3);">
                 <svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-party"></use></svg>
                 <span style="font-size:var(--fs-sm);">${escapeHtml(MILESTONE_MESSAGES[milestone])}</span>
               </div>`
            : ''
        }
        <div class="goal-progress-track" data-tilt-depth="1">
          <div class="goal-progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="row-between" style="font-size:var(--fs-sm);">
          <span class="muted">${goal.currentValue}${escapeHtml(goal.unit)} of ${goal.targetValue}${escapeHtml(goal.unit)}</span>
          <span class="muted" data-percent-for="${goal.id}">${percent}%</span>
        </div>
        <div class="row">
          <input class="input" type="number" step="any" data-progress-input="${goal.id}" placeholder="Update value">
          <button class="btn btn-secondary" data-log-progress-id="${goal.id}">Log</button>
        </div>
      </span>
    </div>
  `;
}
