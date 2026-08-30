import { showScreen } from '../../lib/router.js';
import { escapeHtml } from '../../lib/html.js';
import { calculateBmr, calculateTdee, calorieTargetForCategory, tdeeConfidenceBand } from './bmr-tdee.js';
import { calculateMacroTargets } from './macro-targets.js';
import { getProfile } from '../../db/repositories/profile.js';
import { getLatestCategoryAssignment } from '../../db/repositories/category-assignments.js';
import {
  addNutritionEntry,
  deleteNutritionEntry,
  listNutritionEntriesForDate,
  sumNutritionEntries,
} from '../../db/repositories/nutrition.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function initNutritionFeature() {
  byId('btn-home-nutrition').addEventListener('click', async () => {
    await renderTargets();
    await renderToday();
    showScreen('screen-nutrition');
  });
  byId('btn-nutrition-back').addEventListener('click', () => showScreen('screen-home'));

  byId('btn-nutrition-add').addEventListener('click', async () => {
    const name = byId('nutrition-name').value.trim();
    const calories = Number(byId('nutrition-calories').value);
    const valid = name.length > 0 && calories > 0;
    byId('err-nutrition-entry').hidden = valid;
    if (!valid) return;

    await addNutritionEntry({
      date: todayIsoDate(),
      name,
      calories,
      proteinG: Number(byId('nutrition-protein').value) || 0,
      carbsG: Number(byId('nutrition-carbs').value) || 0,
      fatG: Number(byId('nutrition-fat').value) || 0,
    });

    for (const id of ['nutrition-name', 'nutrition-calories', 'nutrition-protein', 'nutrition-carbs', 'nutrition-fat']) {
      byId(id).value = '';
    }
    await renderToday();
  });
}

async function renderTargets() {
  const [profile, assignment] = await Promise.all([getProfile(), getLatestCategoryAssignment()]);
  if (!profile || !assignment) return;

  const bmr = calculateBmr({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
  });
  const tdee = calculateTdee(bmr, profile.weeklyActiveDays ?? 3);
  const calorieTarget = calorieTargetForCategory(tdee, assignment.category);
  const band = tdeeConfidenceBand(calorieTarget);
  const macros = calculateMacroTargets({ calorieTarget, weightKg: profile.weightKg, category: assignment.category });

  if (!band || !macros) {
    byId('nutrition-calorie-target').textContent = 'Not enough profile info yet to estimate this.';
    return;
  }

  byId('nutrition-calorie-target').textContent = `${band.low}–${band.high} kcal (around ${band.central})`;
  byId('nutrition-calorie-confidence').textContent = `estimated · ${band.confidence}`;
  byId('nutrition-target-protein').textContent = `${macros.proteinG}g`;
  byId('nutrition-target-carbs').textContent = `${macros.carbsG}g`;
  byId('nutrition-target-fat').textContent = `${macros.fatG}g`;
}

async function renderToday() {
  const entries = await listNutritionEntriesForDate(todayIsoDate());
  const totals = sumNutritionEntries(entries);

  byId('nutrition-total-calories').textContent = totals.calories;
  byId('nutrition-total-protein').textContent = `${totals.proteinG}g`;
  byId('nutrition-total-carbs').textContent = `${totals.carbsG}g`;
  byId('nutrition-total-fat').textContent = `${totals.fatG}g`;

  const list = byId('nutrition-entry-list');
  if (entries.length === 0) {
    list.innerHTML = '<p class="muted center-text">Nothing logged yet today.</p>';
    return;
  }

  list.innerHTML = entries
    .map(
      (entry) => `
        <div class="card row-between">
          <span>
            <strong>${escapeHtml(entry.name)}</strong>
            <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${entry.calories} kcal · P${entry.proteinG}g C${entry.carbsG}g F${entry.fatG}g</p>
          </span>
          <button class="btn btn-ghost" data-delete-id="${entry.id}" aria-label="Delete ${escapeHtml(entry.name)}">✕</button>
        </div>
      `
    )
    .join('');

  list.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteNutritionEntry(btn.dataset.deleteId);
      await renderToday();
    });
  });
}
