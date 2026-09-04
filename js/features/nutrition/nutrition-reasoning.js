// Plain-language "why this" lines for the calorie/macro/fiber targets —
// the same transparency Programs already gives its generated plan (see
// program-generator.js's own reasoning array), applied here so a target
// never reads as a black-box number with nothing behind it.

import { formatCategoryLabel } from '../onboarding/wizard.js';

const CATEGORY_CALORIE_REASONING = Object.freeze({
  'sedentary-start':
    'No calorie adjustment yet — building a consistent base first, before layering a deficit or surplus on top.',
  'cut-fat-loss':
    'A 500 kcal/day deficit from maintenance — a standard, sustainable rate for fat loss (roughly 0.5kg/week), not an aggressive crash-diet-sized cut.',
  recomposition: 'A modest 250 kcal/day deficit — small enough to support training while still losing fat.',
  'rehab-recuperation': 'Calories held at maintenance — recovery is the priority here, not a deficit or surplus.',
  hypertrophy: 'A 250 kcal/day surplus — enough to support muscle growth without an excessive rate of fat gain.',
  endurance: 'Calories held at maintenance — endurance training is fueled, not cut or bulked.',
});

/**
 * @param {{category:string, trainingFocus?:string|null, activeDays:number,
 *   proteinGPerKg:number, fiberG:number}} input
 * @returns {string[]}
 */
export function buildNutritionReasoning({ category, trainingFocus = null, activeDays, proteinGPerKg, fiberG }) {
  const dayWord = activeDays === 1 ? 'day' : 'days';
  return [
    `Estimated from your height, weight, age, and sex (Mifflin-St Jeor, the most widely validated BMR formula), scaled by ${activeDays} active ${dayWord}/week.`,
    CATEGORY_CALORIE_REASONING[category] ?? 'Calories held at maintenance.',
    `Protein set at ${proteinGPerKg}g per kg of bodyweight — scaled to your goal (${formatCategoryLabel(category, trainingFocus)}), not one flat number for everyone.`,
    `Fiber target of ${fiberG}g follows the standard dietary guideline of 14g per 1000 kcal.`,
  ];
}
