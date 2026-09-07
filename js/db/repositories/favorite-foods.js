import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** A small, person-curated "log this often" list — distinct from
 *  nutritionEntries (a per-date log of what was actually eaten). Saved
 *  once from either the Quick Add form or a search result, then a
 *  one-tap add from then on.
 *
 *  Saving under a name that's already favorited updates that favorite's
 *  amounts in place rather than inserting a second entry — re-saving
 *  "Oatmeal" with a corrected portion should fix the existing chip, not
 *  leave two "Oatmeal" chips logging different amounts side by side. */
export async function addFavoriteFood({ name, calories, proteinG, carbsG, fatG, fiberG = 0 }, db = getDb()) {
  const trimmedName = name.trim();
  const key = trimmedName.toLowerCase();
  const existing = await db.favoriteFoods.toArray();
  const match = existing.find((f) => f.name.trim().toLowerCase() === key);

  if (match) {
    const updated = { ...match, name: trimmedName, calories, proteinG, carbsG, fatG, fiberG };
    await db.favoriteFoods.put(updated);
    return updated;
  }

  const entry = { id: generateId(), name: trimmedName, calories, proteinG, carbsG, fatG, fiberG, createdAt: nowIso() };
  await db.favoriteFoods.add(entry);
  return entry;
}

export async function listFavoriteFoods(db = getDb()) {
  return db.favoriteFoods.orderBy('createdAt').reverse().toArray();
}

export async function deleteFavoriteFood(id, db = getDb()) {
  await db.favoriteFoods.delete(id);
}
