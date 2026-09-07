import { describe, expect, it } from 'vitest';
import { REGIONAL_STAPLE_FOODS, searchRegionalStaples } from '../../../js/features/nutrition/regional-staples.js';

describe('REGIONAL_STAPLE_FOODS', () => {
  it('gives every staple a positive, real-looking per-100g calorie figure and every macro field', () => {
    for (const food of REGIONAL_STAPLE_FOODS) {
      expect(food.caloriesPer100g).toBeGreaterThan(0);
      expect(food.proteinGPer100g).toBeGreaterThanOrEqual(0);
      expect(food.carbsGPer100g).toBeGreaterThanOrEqual(0);
      expect(food.fatGPer100g).toBeGreaterThanOrEqual(0);
      expect(food.fiberGPer100g).toBeGreaterThanOrEqual(0);
      expect(food.name.length).toBeGreaterThan(0);
      expect(Array.isArray(food.aliases)).toBe(true);
    }
  });

  it('has no duplicate names', () => {
    const names = REGIONAL_STAPLE_FOODS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('searchRegionalStaples', () => {
  it('returns every staple for an empty or whitespace-only query', () => {
    expect(searchRegionalStaples('')).toHaveLength(REGIONAL_STAPLE_FOODS.length);
    expect(searchRegionalStaples('   ')).toHaveLength(REGIONAL_STAPLE_FOODS.length);
  });

  it('matches a staple by its own name, case-insensitively', () => {
    const results = searchRegionalStaples('CASSAVA');
    expect(results.map((f) => f.name)).toContain('Cassava (raw)');
  });

  it('matches a regional dish name via aliases, not just the staple ingredient name', () => {
    expect(searchRegionalStaples('injera').map((f) => f.name)).toContain('Teff, whole grain (raw)');
    expect(searchRegionalStaples('fufu').map((f) => f.name)).toContain('Cassava (raw)');
    expect(searchRegionalStaples('ful medames').map((f) => f.name)).toContain('Fava beans (cooked)');
  });

  it('matches by region', () => {
    expect(searchRegionalStaples('jamaica').map((f) => f.name)).toContain('Ackee (canned, drained)');
  });

  it('returns nothing for a query that matches no staple, name, or alias', () => {
    expect(searchRegionalStaples('zzznonexistentdish')).toEqual([]);
  });
});
