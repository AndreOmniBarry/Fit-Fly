import { describe, expect, it } from 'vitest';
import { computeRecentFoods } from '../../../js/features/nutrition/recent-foods.js';

describe('computeRecentFoods', () => {
  it('is empty with no entries', () => {
    expect(computeRecentFoods([])).toEqual([]);
  });

  it('dedupes by name, keeping the most recently-logged amounts (input is newest first)', () => {
    const entries = [
      { name: 'Oatmeal', calories: 350, proteinG: 12, carbsG: 60, fatG: 6 }, // most recent oatmeal
      { name: 'Banana', calories: 105, proteinG: 1, carbsG: 27, fatG: 0 },
      { name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 5 }, // older oatmeal, should be dropped
    ];
    const result = computeRecentFoods(entries);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(entries[0]); // Oatmeal, the newer amounts
    expect(result[1]).toEqual(entries[1]); // Banana
  });

  it('name matching is case- and whitespace-insensitive', () => {
    const entries = [
      { name: 'chicken and rice', calories: 500, proteinG: 40, carbsG: 60, fatG: 10 },
      { name: ' Chicken And Rice ', calories: 480, proteinG: 38, carbsG: 58, fatG: 9 },
    ];
    expect(computeRecentFoods(entries)).toHaveLength(1);
  });

  it('respects the limit', () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      name: `Food ${i}`,
      calories: 100,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
    }));
    expect(computeRecentFoods(entries, 5)).toHaveLength(5);
  });
});
