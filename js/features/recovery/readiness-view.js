import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { calculateReadiness } from './readiness.js';
import {
  getReadinessCheckinForDate,
  listRecentReadinessCheckins,
  saveReadinessCheckin,
} from '../../db/repositories/readiness.js';
import { listRecentSessions } from '../../db/repositories/sessions.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function countRecentSessions(withinDays = 2) {
  const sessions = await listRecentSessions(20);
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => new Date(s.startedAt).getTime() >= cutoff).length;
}

export function initReadinessFeature() {
  const readinessScreen = byId('screen-readiness');
  const tilt = attachTilt(readinessScreen);
  readinessScreen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });

  const energyChips = initChipGroup(byId('readiness-energy'));
  const sorenessChips = initChipGroup(byId('readiness-soreness'));

  byId('btn-home-readiness').addEventListener('click', async () => {
    await prefillTodayIfLogged();
    await renderHistory();
    showScreen('screen-readiness');
  });
  byId('btn-readiness-back').addEventListener('click', () => showScreen('screen-home'));

  byId('btn-readiness-save').addEventListener('click', async () => {
    const sleepHours = byId('readiness-sleep').value === '' ? null : Number(byId('readiness-sleep').value);
    const energyLevel = energyChips.getValue() ? Number(energyChips.getValue()) : null;
    const sorenessLevel = sorenessChips.getValue() ? Number(sorenessChips.getValue()) : null;

    const hasInput = sleepHours != null || energyLevel != null || sorenessLevel != null;
    byId('err-readiness').hidden = hasInput;
    if (!hasInput) return;

    const recentSessionCount = await countRecentSessions();
    const result = calculateReadiness({ sleepHours, energyLevel, sorenessLevel, recentSessionCount });

    await saveReadinessCheckin({
      date: todayIsoDate(),
      sleepHours,
      energyLevel,
      sorenessLevel,
      recentSessionCount,
      score: result.score,
      category: result.category,
    });

    renderResult(result);
    await renderHistory();
  });

  async function prefillTodayIfLogged() {
    const existing = await getReadinessCheckinForDate(todayIsoDate());
    byId('readiness-sleep').value = existing?.sleepHours ?? '';
    energyChips.setValue(existing?.energyLevel != null ? String(existing.energyLevel) : null);
    sorenessChips.setValue(existing?.sorenessLevel != null ? String(existing.sorenessLevel) : null);

    if (existing) {
      renderResult({ score: existing.score, category: existing.category, reasoning: [] });
    } else {
      byId('readiness-result').hidden = true;
    }
  }
}

function renderResult(result) {
  byId('readiness-score').textContent = `${result.score} / 100`;
  byId('readiness-category').textContent = `estimated · ${result.category}`;
  byId('readiness-reasoning').innerHTML = result.reasoning.map((line) => `<li>${line}</li>`).join('');
  byId('readiness-result').hidden = false;
}

async function renderHistory() {
  const checkins = await listRecentReadinessCheckins(14);
  const list = byId('readiness-history-list');

  if (checkins.length === 0) {
    list.innerHTML = '<p class="muted center-text">No check-ins yet.</p>';
    return;
  }

  list.innerHTML = checkins
    .map(
      (c) => `
        <div class="card row-between tilt-card tilt-enter">
          <span class="row" style="gap:10px; align-items:center;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-sparkle"></use></svg></span>
            <strong>${c.date}</strong>
          </span>
          <span class="data-badge estimated">${c.score} · ${c.category}</span>
        </div>
      `
    )
    .join('');
}
