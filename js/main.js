import { applyThemePreference, isValidThemePreference, applyCategoryAccent } from './lib/theme.js';
import { getPref } from './lib/storage.js';
import { initRouter, showScreen } from './lib/router.js';
import { initOnboardingWizard, formatCategoryLabel } from './features/onboarding/wizard.js';
import { initActivityFeature } from './features/activity/activity-log.js';
import { initRestTimerFeature } from './features/timers/rest-timer.js';
import { initProgramFeature } from './features/programs/program-view.js';
import { initRunFeature } from './features/run/run-tracker.js';
import { initHeartRateFeature } from './features/heart-rate/heart-rate-view.js';
import { initWomensHealthFeature } from './features/womens-health/cycle-log-view.js';
import { initNutritionFeature } from './features/nutrition/nutrition-view.js';
import { seedExerciseLibrary } from './features/exercises/seed.js';
import { getProfile } from './db/repositories/profile.js';
import { getLatestCategoryAssignment } from './db/repositories/category-assignments.js';

function renderHome(profile, assignment) {
  applyCategoryAccent(assignment?.category, document.documentElement);
  document.getElementById('home-category-badge').textContent = assignment
    ? formatCategoryLabel(assignment.category)
    : '—';
}

async function init() {
  const storedTheme = getPref('theme', 'system');
  applyThemePreference(
    isValidThemePreference(storedTheme) ? storedTheme : 'system',
    document.documentElement
  );

  initRouter();
  initActivityFeature();
  initRestTimerFeature();
  initProgramFeature();
  initRunFeature();
  initHeartRateFeature();
  initWomensHealthFeature();
  initNutritionFeature();
  seedExerciseLibrary(); // fire-and-forget — a mirror of the built-in library for future browsing/customization, not on the read path today
  initOnboardingWizard({
    onComplete: ({ profile, categoryResult }) => {
      applyCategoryAccent(categoryResult.category, document.documentElement);
      document.getElementById('home-category-badge').textContent = formatCategoryLabel(
        categoryResult.category
      );
      showScreen('screen-home');
    },
  });

  const [profile, assignment] = await Promise.all([
    getProfile(),
    getLatestCategoryAssignment(),
  ]);

  if (profile && assignment) {
    renderHome(profile, assignment);
    showScreen('screen-home', { focus: false });
  }

  document.getElementById('btn-get-started').addEventListener('click', () => {
    showScreen('screen-ob-basics');
  });

  document.getElementById('btn-home-restart').addEventListener('click', () => {
    // "Start over" only resets which screen is shown — it deliberately
    // does not delete the saved profile/category history.
    showScreen('screen-ob-basics');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
