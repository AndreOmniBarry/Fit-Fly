import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { addFavoriteFood, deleteFavoriteFood, listFavoriteFoods } from '../../../js/db/repositories/favorite-foods.js';

describe('favorite-foods repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`favorite-foods-test-${Math.random()}`);
  });

  it('adds a new favorite with a generated id and timestamp', async () => {
    const favorite = await addFavoriteFood({ name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 6, fiberG: 8 }, db);
    expect(favorite.id).toBeTruthy();
    expect(favorite.createdAt).toBeTruthy();
    expect(await listFavoriteFoods(db)).toHaveLength(1);
  });

  it('re-saving the same name updates the existing favorite instead of duplicating it', async () => {
    const first = await addFavoriteFood({ name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 6, fiberG: 8 }, db);
    const second = await addFavoriteFood({ name: 'Oatmeal', calories: 350, proteinG: 12, carbsG: 55, fatG: 7, fiberG: 9 }, db);

    const all = await listFavoriteFoods(db);
    expect(all).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(all[0].calories).toBe(350);
  });

  it('matches an existing name case- and whitespace-insensitively', async () => {
    await addFavoriteFood({ name: 'Greek Yogurt', calories: 150, proteinG: 15, carbsG: 8, fatG: 4, fiberG: 0 }, db);
    await addFavoriteFood({ name: '  greek yogurt  ', calories: 160, proteinG: 16, carbsG: 8, fatG: 4, fiberG: 0 }, db);

    const all = await listFavoriteFoods(db);
    expect(all).toHaveLength(1);
    expect(all[0].calories).toBe(160);
    expect(all[0].name).toBe('greek yogurt');
  });

  it('keeps distinct names as distinct favorites', async () => {
    await addFavoriteFood({ name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 6, fiberG: 8 }, db);
    await addFavoriteFood({ name: 'Greek Yogurt', calories: 150, proteinG: 15, carbsG: 8, fatG: 4, fiberG: 0 }, db);
    expect(await listFavoriteFoods(db)).toHaveLength(2);
  });

  it('deletes a favorite by id', async () => {
    const favorite = await addFavoriteFood({ name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 6, fiberG: 8 }, db);
    await deleteFavoriteFood(favorite.id, db);
    expect(await listFavoriteFoods(db)).toEqual([]);
  });
});
