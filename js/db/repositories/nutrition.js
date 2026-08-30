import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

export async function addNutritionEntry({ date, name, calories, proteinG, carbsG, fatG }, db = getDb()) {
  const entry = {
    id: generateId(),
    date,
    name,
    calories,
    proteinG,
    carbsG,
    fatG,
    loggedAt: nowIso(),
  };
  await db.nutritionEntries.add(entry);
  return entry;
}

export async function listNutritionEntriesForDate(date, db = getDb()) {
  return db.nutritionEntries.where('date').equals(date).sortBy('loggedAt');
}

export async function deleteNutritionEntry(id, db = getDb()) {
  await db.nutritionEntries.delete(id);
}

/** Sums calories/macros across a day's entries — an empty day sums to
 *  all zeros rather than nulls, since "0 logged so far today" is a real,
 *  displayable state. */
export function sumNutritionEntries(entries) {
  return entries.reduce(
    (totals, e) => ({
      calories: totals.calories + (e.calories ?? 0),
      proteinG: totals.proteinG + (e.proteinG ?? 0),
      carbsG: totals.carbsG + (e.carbsG ?? 0),
      fatG: totals.fatG + (e.fatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}
