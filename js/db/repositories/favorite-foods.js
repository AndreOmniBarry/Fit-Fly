import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** A small, person-curated "log this often" list — distinct from
 *  nutritionEntries (a per-date log of what was actually eaten). Saved
 *  once from either the Quick Add form or a search result, then a
 *  one-tap add from then on. */
export async function addFavoriteFood({ name, calories, proteinG, carbsG, fatG }, db = getDb()) {
  const entry = { id: generateId(), name, calories, proteinG, carbsG, fatG, createdAt: nowIso() };
  await db.favoriteFoods.add(entry);
  return entry;
}

export async function listFavoriteFoods(db = getDb()) {
  return db.favoriteFoods.orderBy('createdAt').reverse().toArray();
}

export async function deleteFavoriteFood(id, db = getDb()) {
  await db.favoriteFoods.delete(id);
}
