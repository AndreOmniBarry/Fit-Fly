import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

export async function addNutritionEntry({ date, name, calories, proteinG, carbsG, fatG, fiberG = 0 }, db = getDb()) {
  const entry = {
    id: generateId(),
    date,
    name,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    loggedAt: nowIso(),
  };
  await db.nutritionEntries.add(entry);
  return entry;
}

export async function listNutritionEntriesForDate(date, db = getDb()) {
  return db.nutritionEntries.where('date').equals(date).sortBy('loggedAt');
}

/** Every entry within an inclusive [startDate, endDate] range (both
 *  'YYYY-MM-DD', sorting lexicographically the same as chronologically)
 *  — the basis for a real weekly trend, not just "today". */
export async function listNutritionEntriesInRange(startDate, endDate, db = getDb()) {
  return db.nutritionEntries.where('date').between(startDate, endDate, true, true).toArray();
}

/** Most-recently-logged entries across every date, newest first — the
 *  raw material for "Recent" quick-add shortcuts (see
 *  js/features/nutrition/recent-foods.js for the dedup/ranking). Capped
 *  well above the handful actually shown, so a long history doesn't mean
 *  scanning it all just to find a few recent distinct names. */
export async function listRecentNutritionEntries(limit = 100, db = getDb()) {
  return db.nutritionEntries.orderBy('loggedAt').reverse().limit(limit).toArray();
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
      fiberG: totals.fiberG + (e.fiberG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );
}
