import { showScreen } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { escapeHtml } from '../../lib/html.js';
import { getNotificationPermission, requestNotificationPermission, showNotification } from '../../lib/notifications.js';
import { calculateProgressPercent, daysUntilDeadline, isGoalAchieved } from './goal-progress.js';
import { createGoal, listActiveGoals, markGoalAchieved, updateGoal } from '../../db/repositories/goals.js';

function byId(id) {
  return document.getElementById(id);
}

export function initGoalsFeature() {
  const directionChips = initChipGroup(byId('goal-direction'), { initial: 'increase' });

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
  const goal = await updateGoal(goalId, { currentValue });
  if (isGoalAchieved(goal)) {
    await markGoalAchieved(goalId);
    showNotification('Goal achieved!', { body: goal.name });
  }
}

function renderGoalCard(goal) {
  const percent = Math.round(calculateProgressPercent(goal));
  const days = daysUntilDeadline(goal.deadline);
  const deadlineText =
    days == null ? '' : days >= 0 ? `${days} day(s) left` : `${Math.abs(days)} day(s) past deadline`;

  return `
    <div class="card stack">
      <div class="row-between">
        <strong>${escapeHtml(goal.name)}</strong>
        <span class="muted" style="font-size:var(--fs-sm);">${deadlineText}</span>
      </div>
      <div class="loading-track" style="height:8px; border-radius:4px; background:var(--border); overflow:hidden;">
        <div style="height:100%; width:${percent}%; background:var(--accent);"></div>
      </div>
      <div class="row-between" style="font-size:var(--fs-sm);">
        <span class="muted">${goal.currentValue}${escapeHtml(goal.unit)} of ${goal.targetValue}${escapeHtml(goal.unit)}</span>
        <span class="muted">${percent}%</span>
      </div>
      <div class="row">
        <input class="input" type="number" step="any" data-progress-input="${goal.id}" placeholder="Update value">
        <button class="btn btn-secondary" data-log-progress-id="${goal.id}">Log</button>
      </div>
    </div>
  `;
}
