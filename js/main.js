import { applyThemePreference, isValidThemePreference, applyCategoryAccent } from './lib/theme.js';
import { getPref } from './lib/storage.js';
import { initRouter, showScreen } from './lib/router.js';
import { initOnboardingWizard, formatCategoryLabel } from './features/onboarding/wizard.js';
import { initActivityFeature } from './features/activity/activity-log.js';
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
