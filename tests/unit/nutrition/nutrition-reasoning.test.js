import { describe, expect, it } from 'vitest';
import { buildNutritionReasoning } from '../../../js/features/nutrition/nutrition-reasoning.js';

describe('buildNutritionReasoning', () => {
  it('names the BMR formula and the exact activity days used', () => {
    const lines = buildNutritionReasoning({
      category: 'endurance',
      activeDays: 4,
      proteinGPerKg: 1.4,
      fiberG: 30,
    });
    expect(lines[0]).toContain('Mifflin-St Jeor');
    expect(lines[0]).toContain('4 active days/week');
  });

  it('uses singular "day" for exactly one active day', () => {
    const lines = buildNutritionReasoning({
      category: 'endurance',
      activeDays: 1,
      proteinGPerKg: 1.4,
      fiberG: 25,
    });
    expect(lines[0]).toContain('1 active day/week');
  });

  it.each([
    ['cut-fat-loss', '500 kcal/day deficit'],
    ['hypertrophy', '250 kcal/day surplus'],
    ['recomposition', '250 kcal/day deficit'],
    ['endurance', 'maintenance'],
    ['rehab-recuperation', 'maintenance'],
    ['sedentary-start', 'No calorie adjustment yet'],
  ])('names the real category-specific calorie rationale for %s', (category, expectedSubstring) => {
    const lines = buildNutritionReasoning({ category, activeDays: 3, proteinGPerKg: 1.4, fiberG: 25 });
    expect(lines[1]).toContain(expectedSubstring);
  });

  it('quotes the exact protein g/kg figure and the goal label driving it', () => {
    const lines = buildNutritionReasoning({
      category: 'hypertrophy',
      trainingFocus: 'strength',
      activeDays: 4,
      proteinGPerKg: 1.8,
      fiberG: 30,
    });
    expect(lines[2]).toContain('1.8g per kg');
    expect(lines[2]).toContain('Strength Training');
  });

  it('cites the real fiber guideline with the exact target amount', () => {
    const lines = buildNutritionReasoning({ category: 'endurance', activeDays: 3, proteinGPerKg: 1.4, fiberG: 28 });
    expect(lines[3]).toContain('28g');
    expect(lines[3]).toContain('14g per 1000 kcal');
  });
});
