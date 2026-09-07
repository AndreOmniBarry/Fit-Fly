// Why this doesn't have photo-based calorie scanning: it was researched
// and deliberately scoped out, not skipped. Accurate food-photo calorie
// estimation needs two things this app has neither of — (1) a food
// classifier good enough to tell a mixed home-cooked dish apart from
// its hundred near-neighbors, which in practice means a paid cloud
// vision API (the accurate consumer apps all use one) or bundling a
// large on-device model with materially worse accuracy, and (2) portion
// *mass* from a single 2D photo, which is a genuinely unsolved problem
// without a depth sensor or a reference object in frame (see the
// ECCV "Computer vision-based food calorie estimation" survey and the
// mobile-app teardowns that reach the same conclusion). This app has no
// budget for a paid vision API and no credentials for one, so building
// this would mean either faking a result behind a spinner or shipping a
// low-accuracy on-device guess dressed up as a real number — both are
// exactly the fabricated-precision this app refuses to show anywhere
// else (see bmr-tdee.js's confidence bands). Rather than fake it, this
// builds the fallback the product review explicitly asked for instead:
// real guidance plus sourced per-100g reference data for the regional
// dishes that don't show up in a typical food database — see
// regional-staples.js and the "Can't find your dish?" panel below.
import { showScreen } from '../../lib/router.js';
import { escapeHtml } from '../../lib/html.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import {
  bucketDailyPoints,
  formatBucketAxisLabel,
  formatBucketDetailLabel,
  timeRangeBounds,
  timeRangeDescription,
} from '../../lib/time-range.js';
import { calculateBmr, calculateTdee, calorieTargetForCategory, tdeeConfidenceBand } from './bmr-tdee.js';
import { calculateMacroTargets, proteinGPerKgForCategory } from './macro-targets.js';
import { buildNutritionReasoning } from './nutrition-reasoning.js';
import { searchFoods } from './food-search.js';
import { computeRecentFoods } from './recent-foods.js';
import { groupCaloriesByDate, lastNDaysRange, summarizeWeeklyNutrition } from './weekly-trend.js';
import { COOKING_OIL_KCAL_PER_TABLESPOON, REGIONAL_STAPLE_FOODS } from './regional-staples.js';
import { DEFAULT_PORTION_GRAMS, scalePortion } from './portion-scaling.js';
import { getProfile } from '../../db/repositories/profile.js';
import { getLatestCategoryAssignment } from '../../db/repositories/category-assignments.js';
import {
  addNutritionEntry,
  deleteNutritionEntry,
  listNutritionEntriesForDate,
  listNutritionEntriesInRange,
  listRecentNutritionEntries,
  sumNutritionEntries,
} from '../../db/repositories/nutrition.js';
import { addFavoriteFood, deleteFavoriteFood, listFavoriteFoods } from '../../db/repositories/favorite-foods.js';

function byId(id) {
  return document.getElementById(id);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// The trend chart's own state — see steps-view.ts's identical comment;
// same reasoning, same default range. Re-fetched on every render (see
// renderCalorieTrend) rather than cached, since nutrition's own logging
// volume is small enough that a fresh IndexedDB query on every range
// switch is genuinely cheap, and it guarantees the chart never goes
// stale after an add/delete elsewhere on the screen.
let nutritionTrendRange = 'W';

export function initNutritionFeature() {
  // Search results are kept here (not re-parsed from the DOM) so a tap
  // just looks the chosen one up by index.
  let lastSearchResults = [];

  // The per-100g food most recently picked (an Open Food Facts result or
  // a regional staple from the "can't find your dish" guidance below) —
  // set on a pick, read by the portion-grams field to rescale the form
  // whenever it changes, and cleared once something's actually added so
  // a leftover base doesn't silently rescale a manually-typed entry.
  let currentPortionBase = null;

  // The regional-staples guidance list is static, curated data — render
  // its chips once rather than re-deriving them on every screen visit.
  byId('nutrition-oil-kcal').textContent = String(COOKING_OIL_KCAL_PER_TABLESPOON);
  byId('nutrition-regional-chips').innerHTML = REGIONAL_STAPLE_FOODS.map(
    (food, i) =>
      `<button type="button" class="chip" data-regional-index="${i}" title="${escapeHtml(food.region)}">${escapeHtml(food.name)}</button>`
  ).join('');

  byId('btn-home-nutrition').addEventListener('click', async () => {
    // renderTargets sets the module-level currentTargets that
    // renderToday/renderWeeklyTrend read for their "vs target" lines —
    // it has to finish first, not race the rest in one Promise.all.
    await renderTargets();
    await Promise.all([renderToday(), renderWeeklyTrend(), renderCalorieTrend(), renderRecent(), renderFavorites()]);
    showScreen('screen-nutrition');
  });
  byId('btn-nutrition-back').addEventListener('click', () => showScreen('screen-home'));

  // ---------- calorie trend range ----------
  initChipGroup(byId('nutrition-trend-range'), {
    initial: nutritionTrendRange,
    onChange: (value) => {
      nutritionTrendRange = value;
      renderCalorieTrend();
    },
  });

  // Same spatial-tilt language as the Fitness Toolkit home list — scoped
  // to just this screen.
  const nutritionScreen = byId('screen-nutrition');
  const nutritionTilt = attachTilt(nutritionScreen);
  nutritionScreen.addEventListener('pointerdown', () => void nutritionTilt.requestMotionPermission(), {
    once: true,
  });

  function fillForm({ name, calories, proteinG, carbsG, fatG, fiberG = 0 }) {
    byId('nutrition-name').value = name;
    byId('nutrition-calories').value = String(calories);
    byId('nutrition-protein').value = String(proteinG);
    byId('nutrition-carbs').value = String(carbsG);
    byId('nutrition-fat').value = String(fatG);
    byId('nutrition-fiber').value = String(fiberG);
  }

  function clearForm() {
    for (const id of [
      'nutrition-name',
      'nutrition-calories',
      'nutrition-protein',
      'nutrition-carbs',
      'nutrition-fat',
      'nutrition-fiber',
    ]) {
      byId(id).value = '';
    }
    byId('nutrition-portion-hint').hidden = true;
    byId('nutrition-portion-grams-wrap').hidden = true;
    byId('nutrition-portion-note').hidden = true;
    currentPortionBase = null;
  }

  /** A per-100g pick (an Open Food Facts result or a regional staple) —
   *  fills the form at the default 100g, arms the portion-grams field to
   *  rescale it, and surfaces the staple's own caveat (if any) instead
   *  of a one-size-fits-all hint. */
  function selectPortionBasedFood(food, note = null) {
    currentPortionBase = food;
    byId('nutrition-portion-grams').value = String(DEFAULT_PORTION_GRAMS);
    fillForm({
      name: food.name,
      calories: food.caloriesPer100g,
      proteinG: food.proteinGPer100g,
      carbsG: food.carbsGPer100g,
      fatG: food.fatGPer100g,
      fiberG: food.fiberGPer100g,
    });
    // A per-100g pick is never "however much you actually ate" — this
    // stays visible until Add or a clear, same rule as the portion
    // field itself, so it's never silently logged as-is.
    byId('nutrition-portion-hint').hidden = false;
    byId('nutrition-portion-grams-wrap').hidden = false;
    byId('nutrition-portion-note').hidden = !note;
    byId('nutrition-portion-note').textContent = note ?? '';
    byId('nutrition-search-results').innerHTML = '';
    byId('nutrition-name').focus();
  }

  // ---------- search (Open Food Facts) ----------
  // Deliberately not live-as-you-type — see food-search.js's own comment
  // on why. Fires on the button or Enter, not on keyup.
  async function runSearch() {
    const query = byId('nutrition-search-query').value.trim();
    const statusEl = byId('nutrition-search-status');
    const resultsEl = byId('nutrition-search-results');
    if (!query) return;

    resultsEl.innerHTML = '';
    statusEl.hidden = false;
    statusEl.textContent = 'Searching…';

    try {
      lastSearchResults = await searchFoods(query);
      if (lastSearchResults.length === 0) {
        statusEl.textContent = 'No matches — try a different search, or enter it manually below.';
        return;
      }
      statusEl.hidden = true;
      resultsEl.innerHTML = lastSearchResults
        .map(
          (food, i) => `
            <button type="button" class="card row-between" data-search-result-index="${i}" style="text-align:left; padding:var(--space-2) var(--space-3);">
              <span>${escapeHtml(food.name)}</span>
              <span class="muted" style="font-size:var(--fs-xs); flex-shrink:0;">${food.caloriesPer100g} kcal /100g</span>
            </button>
          `
        )
        .join('');
    } catch {
      // Most likely offline, or Open Food Facts unreachable — an honest
      // "couldn't reach it" beats a silent "no matches", which would
      // read as this food genuinely not existing.
      statusEl.textContent = "Couldn't reach the food database — check your connection, or enter it manually below.";
    }
  }

  byId('btn-nutrition-search').addEventListener('click', runSearch);
  byId('nutrition-search-query').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });

  byId('nutrition-search-results').addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-result-index]');
    if (!button) return;
    const food = lastSearchResults[Number(button.dataset.searchResultIndex)];
    if (!food) return;
    selectPortionBasedFood(food);
  });

  // ---------- "can't find your dish" regional staples guidance ----------
  // Static, curated reference data (see regional-staples.js) — searched
  // by dish name via its aliases, not just the staple's own name, so
  // tapping in from "injera" or "fufu" works the way someone would
  // actually think to look for it.
  byId('nutrition-regional-chips').addEventListener('click', (event) => {
    const button = event.target.closest('[data-regional-index]');
    if (!button) return;
    const staple = REGIONAL_STAPLE_FOODS[Number(button.dataset.regionalIndex)];
    if (!staple) return;
    selectPortionBasedFood(staple, staple.note ?? null);
  });

  // ---------- portion scaling (per-100g pick -> grams actually eaten) ----------
  byId('nutrition-portion-grams').addEventListener('input', () => {
    if (!currentPortionBase) return;
    const scaled = scalePortion(currentPortionBase, Number(byId('nutrition-portion-grams').value));
    // An empty/zero/invalid grams field leaves the last valid scaled
    // figures in place rather than zeroing them out mid-edit.
    if (!scaled) return;
    byId('nutrition-calories').value = String(scaled.calories);
    byId('nutrition-protein').value = String(scaled.proteinG);
    byId('nutrition-carbs').value = String(scaled.carbsG);
    byId('nutrition-fat').value = String(scaled.fatG);
    byId('nutrition-fiber').value = String(scaled.fiberG);
  });

  // ---------- recent (one-tap — exact amounts already logged before) ----------
  byId('nutrition-recent-chips').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-recent-index]');
    if (!button) return;
    const food = currentRecentFoods[Number(button.dataset.recentIndex)];
    if (!food) return;
    await addNutritionEntry({ date: todayIsoDate(), ...pickFoodFields(food) });
    await Promise.all([renderToday(), renderRecent(), renderWeeklyTrend(), renderCalorieTrend()]);
  });

  // ---------- favorites (one-tap log, or remove) ----------
  byId('nutrition-favorite-chips').addEventListener('click', async (event) => {
    const logButton = event.target.closest('[data-log-favorite-id]');
    if (logButton) {
      const favorite = currentFavorites.find((f) => f.id === logButton.dataset.logFavoriteId);
      if (favorite) {
        await addNutritionEntry({ date: todayIsoDate(), ...pickFoodFields(favorite) });
        await Promise.all([renderToday(), renderRecent(), renderWeeklyTrend(), renderCalorieTrend()]);
      }
      return;
    }
    const removeButton = event.target.closest('[data-remove-favorite-id]');
    if (removeButton) {
      await deleteFavoriteFood(removeButton.dataset.removeFavoriteId);
      await renderFavorites();
    }
  });

  byId('btn-nutrition-save-favorite').addEventListener('click', async () => {
    const name = byId('nutrition-name').value.trim();
    const calories = Number(byId('nutrition-calories').value);
    if (!name || !(calories > 0)) {
      byId('err-nutrition-entry').hidden = false;
      return;
    }
    await addFavoriteFood({
      name,
      calories,
      proteinG: Number(byId('nutrition-protein').value) || 0,
      carbsG: Number(byId('nutrition-carbs').value) || 0,
      fatG: Number(byId('nutrition-fat').value) || 0,
      fiberG: Number(byId('nutrition-fiber').value) || 0,
    });
    await renderFavorites();
  });

  // ---------- manual add ----------
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
      fiberG: Number(byId('nutrition-fiber').value) || 0,
    });

    clearForm();
    await Promise.all([renderToday(), renderRecent(), renderWeeklyTrend(), renderCalorieTrend()]);
  });
}

function pickFoodFields(food) {
  return {
    name: food.name,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG ?? 0,
  };
}

// Populated by renderRecent/renderFavorites, read by the click handlers
// above — same "keep the source of truth in JS, not re-parsed from
// rendered markup" pattern as lastSearchResults.
let currentRecentFoods = [];
let currentFavorites = [];

// Set by renderTargets(), read by renderToday()/renderWeeklyTrend() for
// their "vs target" lines — null with no profile/category assignment yet
// (both back off to their un-compared display in that case).
let currentTargets = null;

async function renderTargets() {
  const [profile, assignment] = await Promise.all([getProfile(), getLatestCategoryAssignment()]);
  if (!profile || !assignment) {
    currentTargets = null;
    return;
  }

  const activeDays = profile.weeklyActiveDays ?? 3;
  const bmr = calculateBmr({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
  });
  const tdee = calculateTdee(bmr, activeDays);
  const calorieTarget = calorieTargetForCategory(tdee, assignment.category);
  const band = tdeeConfidenceBand(calorieTarget);
  const macros = calculateMacroTargets({ calorieTarget, weightKg: profile.weightKg, category: assignment.category });

  if (!band || !macros) {
    currentTargets = null;
    byId('nutrition-calorie-target').textContent = 'Not enough profile info yet to estimate this.';
    byId('nutrition-reasoning-wrap').hidden = true;
    return;
  }

  currentTargets = { band, macros };

  byId('nutrition-calorie-target').textContent = `${band.low}–${band.high} kcal (around ${band.central})`;
  byId('nutrition-calorie-confidence').textContent = `estimated · ${band.confidence}`;
  byId('nutrition-target-protein').textContent = `${macros.proteinG}g`;
  byId('nutrition-target-carbs').textContent = `${macros.carbsG}g`;
  byId('nutrition-target-fat').textContent = `${macros.fatG}g`;
  byId('nutrition-target-fiber').textContent = `${macros.fiberG}g`;

  const reasoning = buildNutritionReasoning({
    category: assignment.category,
    trainingFocus: assignment.trainingFocus,
    activeDays,
    proteinGPerKg: proteinGPerKgForCategory(assignment.category),
    fiberG: macros.fiberG,
  });
  byId('nutrition-reasoning').innerHTML = reasoning.map((line) => `<li>${line}</li>`).join('');
  byId('nutrition-reasoning-wrap').hidden = false;
}

async function renderToday() {
  const entries = await listNutritionEntriesForDate(todayIsoDate());
  const totals = sumNutritionEntries(entries);

  // Real numbers arriving, same kinetic-data language as the rest of the
  // app — this is the one figure on the screen that actually changes as
  // you use it, so it's the one worth animating.
  const gramsFormatter = (n) => `${Math.round(n)}g`;
  animateCountUp(byId('nutrition-total-calories'), totals.calories);
  animateCountUp(byId('nutrition-total-protein'), totals.proteinG, { formatter: gramsFormatter });
  animateCountUp(byId('nutrition-total-carbs'), totals.carbsG, { formatter: gramsFormatter });
  animateCountUp(byId('nutrition-total-fat'), totals.fatG, { formatter: gramsFormatter });
  animateCountUp(byId('nutrition-total-fiber'), totals.fiberG, { formatter: gramsFormatter });

  // A real comparison against today's target, not just a floating total
  // with nothing to measure it against — honest subtraction, so it goes
  // negative ("over") rather than clamping at zero and hiding it.
  const remainingEl = byId('nutrition-remaining');
  if (currentTargets) {
    const remaining = currentTargets.band.central - totals.calories;
    remainingEl.hidden = false;
    remainingEl.textContent =
      remaining >= 0 ? `${remaining} kcal remaining today` : `${Math.abs(remaining)} kcal over today's target`;
  } else {
    remainingEl.hidden = true;
  }

  const list = byId('nutrition-entry-list');
  if (entries.length === 0) {
    list.innerHTML = '<p class="muted center-text">Nothing logged yet today.</p>';
    return;
  }

  list.innerHTML = entries
    .map(
      (entry) => `
        <div class="card row-between tilt-card tilt-enter">
          <span class="row" style="gap:10px; align-items:center;">
            <span class="fitness-row-icon" data-tilt-depth="1" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-flame"></use></svg></span>
            <span>
              <strong>${escapeHtml(entry.name)}</strong>
              <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${entry.calories} kcal · P${entry.proteinG}g C${entry.carbsG}g F${entry.fatG}g${entry.fiberG ? ` · Fiber${entry.fiberG}g` : ''}</p>
            </span>
          </span>
          <button class="btn btn-ghost" data-delete-id="${entry.id}" aria-label="Delete ${escapeHtml(entry.name)}">✕</button>
        </div>
      `
    )
    .join('');

  list.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteNutritionEntry(btn.dataset.deleteId);
      await Promise.all([renderToday(), renderRecent(), renderWeeklyTrend(), renderCalorieTrend()]);
    });
  });
}

/** Real insight from a week of logging, not just today's total. Hidden
 *  entirely with nothing logged in the window, rather than a zeroed
 *  card. */
async function renderWeeklyTrend() {
  const { startDate, endDate, dayCount } = lastNDaysRange(7);
  const entries = await listNutritionEntriesInRange(startDate, endDate);
  const trend = summarizeWeeklyNutrition(entries, dayCount);

  const card = byId('nutrition-weekly-card');
  card.hidden = !trend;
  if (!trend) return;

  // Compared against the same target the "Today" card shows, not a bare
  // number with nothing to read it against.
  byId('nutrition-weekly-avg-calories').textContent = currentTargets
    ? `${trend.avgCalories} kcal (target ~${currentTargets.band.central})`
    : `${trend.avgCalories} kcal`;
  byId('nutrition-weekly-days-logged').textContent = `${trend.daysLogged}/${trend.dayCount} days`;
  byId('nutrition-weekly-avg-protein').textContent = `${trend.avgProteinG}g`;
  byId('nutrition-weekly-avg-fiber').textContent = `${trend.avgFiberG}g`;
}

/** A real D/W/M/6M/Y calorie trend (see js/lib/time-range.js), the
 *  visual chart the fixed 7-day "This week" card above never had — same
 *  daily-for-D/W/M, weekly-for-6M, monthly-for-Y bucketing convention
 *  Steps/Hydration already use. Compared against the same calorie
 *  target the "Today"/"This week" cards already show, via the chart's
 *  own reference line. */
async function renderCalorieTrend() {
  const bounds = timeRangeBounds(nutritionTrendRange, todayIsoDate());
  byId('nutrition-trend-range-copy').textContent = timeRangeDescription(nutritionTrendRange);

  const entries = await listNutritionEntriesInRange(bounds.start, bounds.end);
  const dailyTotals = groupCaloriesByDate(entries);
  const daily = [...dailyTotals.entries()].map(([date, calories]) => ({ date, value: calories }));
  const buckets = bucketDailyPoints(daily, bounds.bucket);
  const isBucketed = bounds.bucket !== 'day';
  const target = currentTargets?.band.central;

  renderTrendChart(byId('nutrition-trend-chart'), {
    points: buckets.map((bucket) => ({
      key: bucket.key,
      value: bucket.value,
      axisLabel: formatBucketAxisLabel(bucket.key, bounds.bucket),
      tooltipValue: `${Math.round(bucket.value).toLocaleString()} kcal${isBucketed ? '/day avg' : ''}`,
      tooltipDetail: formatBucketDetailLabel(bucket.key, bounds.bucket),
    })),
    accentVar: '--accent',
    referenceValue: target,
    emptyMessage: 'Log a second day to start a trend.',
  });
}

async function renderRecent() {
  const entries = await listRecentNutritionEntries();
  currentRecentFoods = computeRecentFoods(entries);

  const wrap = byId('nutrition-recent-wrap');
  wrap.hidden = currentRecentFoods.length === 0;
  byId('nutrition-recent-chips').innerHTML = currentRecentFoods
    .map((food, i) => `<button type="button" class="chip" data-recent-index="${i}">${escapeHtml(food.name)}</button>`)
    .join('');
}

async function renderFavorites() {
  currentFavorites = await listFavoriteFoods();

  const wrap = byId('nutrition-favorites-wrap');
  wrap.hidden = currentFavorites.length === 0;
  byId('nutrition-favorite-chips').innerHTML = currentFavorites
    .map(
      (food) => `
        <button type="button" class="chip" data-log-favorite-id="${food.id}">${escapeHtml(food.name)}</button>
        <button type="button" class="icon-btn" data-remove-favorite-id="${food.id}" aria-label="Remove ${escapeHtml(food.name)} from favorites" style="width:26px; height:26px;">
          <svg class="icon" width="12" height="12" viewBox="0 0 24 24"><use href="#icon-x"></use></svg>
        </button>
      `
    )
    .join('');
}
