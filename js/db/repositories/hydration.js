import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function addHydrationEntry({ amountMl, date = todayIsoDate() }, db = getDb()) {
  const entry = { id: generateId(), date, amountMl, loggedAt: nowIso() };
  await db.hydrationEntries.add(entry);
  return entry;
}

export async function listHydrationEntriesForDate(date = todayIsoDate(), db = getDb()) {
  return db.hydrationEntries.where('date').equals(date).sortBy('loggedAt');
}

/** Every entry within an inclusive [startDate, endDate] range — the
 *  basis for a real streak/weekly-average trend, same pattern as
 *  Nutrition's own listNutritionEntriesInRange. */
export async function listHydrationEntriesInRange(startDate, endDate, db = getDb()) {
  return db.hydrationEntries.where('date').between(startDate, endDate, true, true).toArray();
}

export async function listRecentHydrationEntries(limit = 100, db = getDb()) {
  return db.hydrationEntries.orderBy('loggedAt').reverse().limit(limit).toArray();
}

export async function deleteHydrationEntry(id, db = getDb()) {
  await db.hydrationEntries.delete(id);
}

/** Sums a day's entries — an empty day sums to 0 rather than null,
 *  since "0 logged so far today" is a real, displayable state, same
 *  contract as Nutrition's sumNutritionEntries. */
export function sumHydrationEntries(entries) {
  return entries.reduce((total, e) => total + (e.amountMl ?? 0), 0);
}
