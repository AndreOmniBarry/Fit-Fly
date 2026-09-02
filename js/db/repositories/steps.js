import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const STEP_SOURCE = Object.freeze({
  MANUAL: 'manual',
  SENSOR: 'sensor',
});

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** A live-counted walk's real steps are always genuinely new activity
 *  happening right now — several walks in one day should add up, never
 *  overwrite each other. */
export async function addStepsToDate(steps, date = todayIsoDate(), db = getDb()) {
  const existing = await db.stepEntries.get(date);
  const entry = {
    date,
    steps: (existing?.steps ?? 0) + steps,
    source: STEP_SOURCE.SENSOR,
    updatedAt: nowIso(),
  };
  await db.stepEntries.put(entry);
  return entry;
}

/** A manual entry means "here's my real total for the day" (e.g. read off
 *  a phone's own health app or a fitness band) — it sets the day's count
 *  outright rather than adding to whatever's already logged, since it's
 *  meant to be the authoritative number, not an increment. */
export async function setStepsForDate(steps, date = todayIsoDate(), db = getDb()) {
  const entry = { date, steps, source: STEP_SOURCE.MANUAL, updatedAt: nowIso() };
  await db.stepEntries.put(entry);
  return entry;
}

export async function getStepEntryForDate(date = todayIsoDate(), db = getDb()) {
  return db.stepEntries.get(date);
}

export async function listRecentStepEntries(limit = 30, db = getDb()) {
  return db.stepEntries.orderBy('date').reverse().limit(limit).toArray();
}
