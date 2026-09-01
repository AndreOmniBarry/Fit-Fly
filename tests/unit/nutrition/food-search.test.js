import { describe, expect, it, vi } from 'vitest';
import { searchFoods } from '../../../js/features/nutrition/food-search.js';

function fakeFetch(body, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}

describe('searchFoods', () => {
  it('is empty for a blank query — never fires a request for nothing', async () => {
    const fetchImpl = fakeFetch({ products: [] });
    const result = await searchFoods('   ', { fetchImpl });
    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('normalizes a real Open Food Facts-shaped response into per-100g figures', async () => {
    const fetchImpl = fakeFetch({
      products: [
        {
          product_name: 'Rolled Oats',
          nutriments: { 'energy-kcal_100g': 389, proteins_100g: 16.9, carbohydrates_100g: 66.3, fat_100g: 6.9 },
        },
      ],
    });
    const result = await searchFoods('oats', { fetchImpl });
    expect(result).toEqual([
      { name: 'Rolled Oats', caloriesPer100g: 389, proteinGPer100g: 17, carbsGPer100g: 66, fatGPer100g: 7 },
    ]);
  });

  it('skips a product with no name or no usable calorie figure, rather than showing a broken result', async () => {
    const fetchImpl = fakeFetch({
      products: [
        { product_name: '', nutriments: { 'energy-kcal_100g': 100 } }, // no name
        { product_name: 'Mystery Item', nutriments: {} }, // no calories
        { product_name: 'Banana', nutriments: { 'energy-kcal_100g': 89 } }, // the one good result
      ],
    });
    const result = await searchFoods('food', { fetchImpl });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Banana');
  });

  it('defaults missing macro fields to 0g rather than throwing or showing NaN', async () => {
    const fetchImpl = fakeFetch({
      products: [{ product_name: 'Water', nutriments: { 'energy-kcal_100g': 0.1 } }],
    });
    const result = await searchFoods('water', { fetchImpl });
    expect(result[0]).toMatchObject({ proteinGPer100g: 0, carbsGPer100g: 0, fatGPer100g: 0 });
  });

  it('a missing "products" field in the response is treated as no results, not a crash', async () => {
    const fetchImpl = fakeFetch({});
    const result = await searchFoods('anything', { fetchImpl });
    expect(result).toEqual([]);
  });

  it('throws on a non-OK response, rather than silently returning an empty (misleading "no matches") result', async () => {
    const fetchImpl = fakeFetch({}, { ok: false, status: 503 });
    await expect(searchFoods('anything', { fetchImpl })).rejects.toThrow('503');
  });

  it('throws a clear error when no fetch implementation is available at all', async () => {
    // null, not undefined — a default parameter only kicks in for
    // undefined, and this test needs to force the "truly absent" branch
    // rather than falling through to this environment's own real
    // globalThis.fetch (which would attempt a real network call).
    await expect(searchFoods('anything', { fetchImpl: null })).rejects.toThrow(/fetch/i);
  });
});
