import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

/** Records one completed field test. `protocol` is 'cooper' | 'rockport'
 *  (see js/features/vitals/vo2max-estimate.ts); `inputs` keeps the real
 *  raw numbers the estimate was computed from (distanceMeters for
 *  Cooper; weightKg/ageYears/sex/timeMinutes/heartRateBpm for Rockport)
 *  so a past test's own inputs stay inspectable, not just its output. */
export async function recordVo2maxTest({ vo2max, protocol, inputs }, db = getDb()) {
  const entry = { vo2max, protocol, inputs, recordedAt: nowIso() };
  const id = await db.vo2maxTests.add(entry);
  return { ...entry, id };
}

export async function listRecentVo2maxTests(limit = 20, db = getDb()) {
  return db.vo2maxTests.orderBy('recordedAt').reverse().limit(limit).toArray();
}
