// Pure label-mapping logic, deliberately separated from wizard.js's DOM
// wiring — no document/window touch here. Shared by onboarding's own
// result screen, the Fitness Toolkit home badge, and Programs/Nutrition's
// own reasoning copy, none of which should need to import a DOM-heavy
// view file just to get a category's display name.
const CATEGORY_LABELS = {
  'sedentary-start': 'Building Your Base',
  'cut-fat-loss': 'Fat Loss',
  recomposition: 'Recomposition',
  'rehab-recuperation': 'Rehab & Recuperation',
  hypertrophy: 'Hypertrophy',
  endurance: 'Endurance',
};

/** `trainingFocus` only ever distinguishes anything within the
 *  'hypertrophy' category (see category-engine.js) — 'strength' gets its
 *  own real label rather than being folded into "Hypertrophy," since
 *  it's a genuinely different rep-range/rest/set prescription
 *  underneath, not the same program relabeled. */
export function formatCategoryLabel(category, trainingFocus = null) {
  if (category === 'hypertrophy' && trainingFocus === 'strength') return 'Strength Training';
  return CATEGORY_LABELS[category] ?? category;
}
