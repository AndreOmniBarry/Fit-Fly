import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const BP_SOURCE = Object.freeze({
  MANUAL: 'manual',
  BLE: 'ble',
});

/** Both sources here are MEASURED, never estimated — there's no camera-
 *  based technique for blood pressure at all (see the README), so unlike
 *  heart rate there's no third, estimated source and nothing to grade
 *  with a confidence. */
export async function recordBloodPressureSample({ systolic, diastolic, pulseRate = null, source }, db = getDb()) {
  const entry = { systolic, diastolic, pulseRate, source, recordedAt: nowIso() };
  const id = await db.bloodPressureSamples.add(entry);
  return { ...entry, id };
}

export async function listRecentBloodPressureSamples(limit = 50, db = getDb()) {
  return db.bloodPressureSamples.orderBy('recordedAt').reverse().limit(limit).toArray();
}
