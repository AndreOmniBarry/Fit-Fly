import { applyThemePreference, isValidThemePreference, applyCategoryAccent } from './lib/theme.js';
import { getPref, setPref } from './lib/storage.js';
import { initRouter, showScreen } from './lib/router.js';
import { initOnboardingWizard, formatCategoryLabel } from './features/onboarding/wizard.js';
import { initActivityFeature } from './features/activity/activity-log.js';
import { initRestTimerFeature } from './features/timers/rest-timer.js';
import { initProgramFeature } from './features/programs/program-view.js';
import { initRunFeature } from './features/run/run-tracker.js';
import { initHeartRateFeature } from './features/heart-rate/heart-rate-view.js';
import { initWomensHealthFeature } from './features/womens-health/cycle-log-view.js';
import { initNutritionFeature } from './features/nutrition/nutrition-view.js';
import { initReadinessFeature } from './features/recovery/readiness-view.js';
import { initGoalsFeature } from './features/goals/goals-view.js';
import { initVoiceFeature } from './features/voice/voice-control.js';
import { initHubFeature } from './features/hub/hub-view.js';
import { initSleepFeature } from './features/sleep/sleep-view.js';
import { initFocusFeature } from './features/focus/focus-view.js';
import { initGuidedSessionFeature } from './features/focus/guided-session-view.js';
import { initMeditateFeature } from './features/meditate/meditate-view.js';
import { initVitalsFeature } from './features/vitals/vitals-view.js';
import { initStepsFeature } from './features/steps/steps-view.js';
import { initHydrationFeature } from './features/hydration/hydration-view.js';
import { initSettingsFeature } from './features/settings/settings-view.js';
import { seedExerciseLibrary } from './features/exercises/seed.js';
import { getProfile } from './db/repositories/profile.js';
import { getLatestCategoryAssignment } from './db/repositories/category-assignments.js';
import { attachTilt } from './lib/tilt.js';
import { registerServiceWorker } from './lib/register-service-worker.js';

function renderHome(profile, assignment) {
  applyCategoryAccent(assignment?.category, document.documentElement);
  document.getElementById('home-category-badge').textContent = assignment
    ? formatCategoryLabel(assignment.category, assignment.trainingFocus)
    : '—';
}

/** Shown on the Fitness Toolkit screen whenever there's no profile yet —
 *  someone who skipped onboarding can still use Sleep/Focus (and
 *  most Fitness Toolkit screens, which degrade gracefully on their own),
 *  but programs/calorie targets/readiness genuinely need real inputs to
 *  say anything, so this says so plainly instead of quietly showing
 *  nothing. */
async function refreshProfileBanner() {
  const profile = await getProfile();
  document.getElementById('fitness-toolkit-no-profile-banner').hidden = Boolean(profile);
}

/** Re-reads the latest category assignment every time the Fitness
 *  Toolkit screen is opened — My Program's own "Change Goal" can change
 *  it without ever passing back through this file, so this badge (set
 *  once at app load / onboarding completion otherwise) would silently
 *  go stale without a real refresh here. */
async function refreshCategoryBadge() {
  const assignment = await getLatestCategoryAssignment();
  renderHome(await getProfile(), assignment);
}

async function init() {
  const storedTheme = getPref('theme', 'system');
  applyThemePreference(
    isValidThemePreference(storedTheme) ? storedTheme : 'system',
    document.documentElement
  );

  registerServiceWorker();

  initRouter();
  initActivityFeature();
  initRestTimerFeature();
  initProgramFeature();
  initRunFeature();
  initHeartRateFeature();
  initWomensHealthFeature();
  initNutritionFeature();
  initReadinessFeature();
  initGoalsFeature();
  initVoiceFeature();
  initHubFeature();
  initSleepFeature();
  initFocusFeature();
  const guidedSessionPlayer = initGuidedSessionFeature();
  initMeditateFeature(guidedSessionPlayer);
  initVitalsFeature();
  initStepsFeature();
  initHydrationFeature();
  initSettingsFeature();

  // Same spatial-tilt language as the Hub, Sleep's dashboard, and Focus —
  // the Fitness Toolkit's own home list gets it too, scoped to just this
  // screen the same way each of those is scoped to its own.
  const fitnessToolkitScreen = document.getElementById('screen-home');
  const fitnessToolkitTilt = attachTilt(fitnessToolkitScreen);
  fitnessToolkitScreen.addEventListener('pointerdown', () => void fitnessToolkitTilt.requestMotionPermission(), {
    once: true,
  });
  seedExerciseLibrary(); // fire-and-forget — a mirror of the built-in library for future browsing/customization, not on the read path today
  initOnboardingWizard({
    onComplete: ({ profile, categoryResult }) => {
      applyCategoryAccent(categoryResult.category, document.documentElement);
      document.getElementById('home-category-badge').textContent = formatCategoryLabel(
        categoryResult.category,
        categoryResult.trainingFocus
      );
      showScreen('screen-hub');
    },
  });

  const [profile, assignment] = await Promise.all([
    getProfile(),
    getLatestCategoryAssignment(),
  ]);
  const skippedOnboarding = getPref('onboardingSkipped') === 'true';

  if (profile && assignment) {
    renderHome(profile, assignment);
    showScreen('screen-hub', { focus: false });
  } else if (skippedOnboarding) {
    showScreen('screen-hub', { focus: false });
  }

  document.getElementById('btn-get-started').addEventListener('click', () => {
    showScreen('screen-ob-basics');
  });

  // Onboarding isn't required to use Sleep or Focus — neither needs
  // profile data at all. It comes back later for anyone who wants the
  // Fitness Toolkit's personalized programs/targets (see
  // refreshProfileBanner and btn-fitness-toolkit-setup-profile below).
  document.getElementById('btn-skip-onboarding').addEventListener('click', () => {
    setPref('onboardingSkipped', 'true');
    showScreen('screen-hub');
  });

  document.getElementById('btn-fitness-toolkit-setup-profile').addEventListener('click', () => {
    showScreen('screen-ob-basics');
  });

  document.getElementById('btn-home-fitness-toolkit').addEventListener('click', () => {
    void refreshProfileBanner();
    void refreshCategoryBadge();
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
