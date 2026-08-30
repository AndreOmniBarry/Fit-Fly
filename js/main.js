import { applyThemePreference, isValidThemePreference } from './lib/theme.js';
import { getPref } from './lib/storage.js';

function init() {
  const storedTheme = getPref('theme', 'system');
  applyThemePreference(
    isValidThemePreference(storedTheme) ? storedTheme : 'system',
    document.documentElement
  );

  const getStarted = document.getElementById('btn-get-started');
  getStarted?.addEventListener('click', () => {
    // Onboarding + the category engine land in a later phase. For now the
    // splash screen is the whole app, wired end to end with no dead links.
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
