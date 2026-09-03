import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { ACTIVITY_TYPES, INTENSITIES, getActivityType } from './activity-types.js';
import { estimateActivityCalories } from './calorie-estimate.js';
import { createSession, listRecentSessions } from '../../db/repositories/sessions.js';
import { getProfile } from '../../db/repositories/profile.js';

function byId(id) {
  return document.getElementById(id);
}

function showError(id, show) {
  const el = byId(id);
  if (el) el.hidden = !show;
}

/** Wires the "Log Activity" form and the "History" list, both reachable
 *  from the home dashboard's action cards. */
export function initActivityFeature() {
  // Same spatial-tilt language as the rest of the Fitness Toolkit — both
  // screens get their own scoped instance.
  for (const screenId of ['screen-activity-log', 'screen-activity-history']) {
    const screen = byId(screenId);
    const tilt = attachTilt(screen);
    screen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
  }

  const typeContainer = byId('activity-type');
  typeContainer.innerHTML = ACTIVITY_TYPES.map(
    (a) => `<button type="button" class="chip" data-value="${a.id}" aria-pressed="false">${a.label}</button>`
  ).join('');
  const typeChips = initChipGroup(typeContainer);

  const intensityContainer = byId('activity-intensity');
  intensityContainer.innerHTML = INTENSITIES.map(
    (i) => `<button type="button" class="chip" data-value="${i.id}" aria-pressed="false">${i.label}</button>`
  ).join('');
  const intensityChips = initChipGroup(intensityContainer, { initial: 'moderate' });

  byId('btn-home-log-activity').addEventListener('click', () => showScreen('screen-activity-log'));
  byId('btn-activity-cancel').addEventListener('click', () => showScreen('screen-home'));

  byId('btn-activity-save').addEventListener('click', async () => {
    const activityTypeId = typeChips.getValue();
    const durationMinutes = Number(byId('activity-duration').value);

    showError('err-activity-type', !activityTypeId);
    showError('err-activity-duration', !(durationMinutes > 0));
    if (!activityTypeId || !(durationMinutes > 0)) return;

    const intensityId = intensityChips.getValue() ?? 'moderate';
    const notes = byId('activity-notes').value.trim();
    const profile = await getProfile();
    const caloriesEstimate = estimateActivityCalories({
      activityTypeId,
      intensityId,
      durationMinutes,
      weightKg: profile?.weightKg,
    });

    await createSession({
      type: 'activity',
      activityTypeId,
      intensityId,
      durationMinutes,
      caloriesEstimate,
      notes,
    });

    // reset the form for next time
    byId('activity-duration').value = '';
    byId('activity-notes').value = '';
    typeChips.setValue(null);
    intensityChips.setValue('moderate');

    showScreen('screen-home');
  });

  byId('btn-home-history').addEventListener('click', async () => {
    await renderHistory();
    showScreen('screen-activity-history');
  });
  byId('btn-history-back').addEventListener('click', () => showScreen('screen-home'));
}

async function renderHistory() {
  const sessions = await listRecentSessions(50);
  const activitySessions = sessions.filter((s) => s.type === 'activity');
  const list = byId('activity-history-list');

  if (activitySessions.length === 0) {
    list.innerHTML = '<p class="muted center-text">Nothing logged yet — your first activity will show up here.</p>';
    return;
  }

  list.innerHTML = activitySessions.map(renderHistoryItem).join('');
}

function renderHistoryItem(session) {
  const activity = getActivityType(session.activityTypeId);
  const dateLabel = new Date(session.startedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const cal = session.caloriesEstimate;

  return `
    <div class="card row-between tilt-card tilt-enter">
      <span class="row" style="gap:10px; align-items:center;">
        <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-sliders"></use></svg></span>
        <span>
          <strong>${activity?.label ?? 'Activity'}</strong>
          <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${dateLabel} · ${session.durationMinutes} min</p>
        </span>
      </span>
      ${cal ? `<span class="data-badge estimated">${cal.kcal} kcal</span>` : ''}
    </div>
  `;
}
