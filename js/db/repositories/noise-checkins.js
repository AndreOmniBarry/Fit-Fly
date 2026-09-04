import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

/** Every check-in comes from the same real capture pipeline
 *  (js/features/hearing/noise-capture.js) — there's no manual-entry path
 *  for a sound level the way there is for heart rate, since a person
 *  typing in "72 dB" has no real basis the way a typed-in heart rate
 *  (read off another device) does. */
export async function recordNoiseCheckIn({ estimatedDb, category }, db = getDb()) {
  const entry = { estimatedDb, category, recordedAt: nowIso() };
  const id = await db.noiseCheckIns.add(entry);
  return { ...entry, id };
}

export async function listRecentNoiseCheckIns(limit = 50, db = getDb()) {
  return db.noiseCheckIns.orderBy('recordedAt').reverse().limit(limit).toArray();
}

/** Every logged check-in, unbounded — the basis for a real lifetime
 *  streak/count, same "personal bests/streaks come from the whole
 *  history, not a recent window" contract as Run's own listAllRuns(). */
export async function listAllNoiseCheckIns(db = getDb()) {
  return db.noiseCheckIns.toArray();
}
