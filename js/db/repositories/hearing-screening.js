import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** One completed pure-tone screening test — see
 *  js/features/hearing/pure-tone-test.js for what `results` really means
 *  (a relative, same-device gain threshold per frequency/ear, never a
 *  calibrated dB HL figure). Saved whole, in one write, the same "never
 *  a partially-saved test" contract js/db/repositories/sessions.js's own
 *  createSession(sets) already uses for a strength session's sets. */
export async function saveHearingScreeningTest(results, db = getDb()) {
  const test = { id: generateId(), completedAt: nowIso(), results };
  await db.hearingScreeningTests.put(test);
  return test;
}

/** Every completed test, most recent first — the basis for comparing
 *  the latest test against whichever one came before it (see
 *  pure-tone-test.js's compareThresholdChange). */
export async function listHearingScreeningTests(db = getDb()) {
  return db.hearingScreeningTests.orderBy('completedAt').reverse().toArray();
}
