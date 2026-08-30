// Daily macro targets from a calorie target + bodyweight + category.
// Protein is set per kg of bodyweight (the standard way to scale it,
// more physiologically meaningful than a fixed % of calories), fat is a
// fixed share of total calories, and carbs take whatever calories are
// left — never negative, even for a very low calorie target with a high
// protein/fat floor.

const PROTEIN_G_PER_KG_BY_CATEGORY = Object.freeze({
  'sedentary-start': 1.2,
  'cut-fat-loss': 2.0, // higher in a deficit, to protect muscle
  recomposition: 1.8,
  'rehab-recuperation': 1.2,
  hypertrophy: 1.8,
  endurance: 1.4,
});

const FAT_SHARE_OF_CALORIES = 0.3;

/**
 * @returns {{proteinG: number, fatG: number, carbsG: number}|null}
 */
export function calculateMacroTargets({ calorieTarget, weightKg, category }) {
  if (!(calorieTarget > 0) || !(weightKg > 0)) return null;

  const proteinGPerKg = PROTEIN_G_PER_KG_BY_CATEGORY[category] ?? 1.4;
  const proteinG = Math.round(proteinGPerKg * weightKg);
  const proteinCalories = proteinG * 4;

  const fatCalories = calorieTarget * FAT_SHARE_OF_CALORIES;
  const fatG = Math.round(fatCalories / 9);

  const remainingCalories = Math.max(0, calorieTarget - proteinCalories - fatCalories);
  const carbsG = Math.round(remainingCalories / 4);

  return { proteinG, fatG, carbsG };
}
