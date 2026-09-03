import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const STEP_SOURCE = Object.freeze({
  MANUAL: 'manual',
  SENSOR: 'sensor',
  NATIVE_PEDOMETER: 'native-pedometer',
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

/** The native background pedometer's own "today's real total" — see
 *  js/features/steps/native-pedometer.js. Like a manual entry, this is
 *  an authoritative day total (the OS's own hardware counter, not an
 *  increment), just tagged with its own honest source so the UI can
 *  show *how* a day's number is known to be real, not only that it is. */
export async function syncStepsFromNativePedometer(steps, date = todayIsoDate(), db = getDb()) {
  const entry = { date, steps, source: STEP_SOURCE.NATIVE_PEDOMETER, updatedAt: nowIso() };
  await db.stepEntries.put(entry);
  return entry;
}

export async function getStepEntryForDate(date = todayIsoDate(), db = getDb()) {
  return db.stepEntries.get(date);
}

export async function listRecentStepEntries(limit = 30, db = getDb()) {
  return db.stepEntries.orderBy('date').reverse().limit(limit).toArray();
}

/** Every logged day, unbounded — the basis for a real "best day ever"
 *  claim (js/features/steps/steps-trend.js's bestStepsDayEver), same
 *  "personal bests come from the whole history, not a recent window"
 *  contract as Run's own listAllRuns(). */
export async function listAllStepEntries(db = getDb()) {
  return db.stepEntries.toArray();
}
