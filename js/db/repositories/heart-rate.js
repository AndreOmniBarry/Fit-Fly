import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const HR_SOURCE = Object.freeze({
  CAMERA_PPG: 'camera-ppg',
  MANUAL: 'manual',
  BLE: 'ble',
});

/** confidence is only meaningful (and only ever set) for camera-ppg
 *  readings — a manual entry or a real BLE strap reading is MEASURED,
 *  not an estimate, so there's nothing to grade. */
export async function recordHeartRateSample({ bpm, source, confidence = null, sessionId = null }, db = getDb()) {
  const entry = { bpm, source, confidence, sessionId, recordedAt: nowIso() };
  const id = await db.heartRateSamples.add(entry);
  return { ...entry, id };
}

export async function listRecentHeartRateSamples(limit = 50, db = getDb()) {
  return db.heartRateSamples.orderBy('recordedAt').reverse().limit(limit).toArray();
}

export async function listHeartRateSamplesBySource(source, db = getDb()) {
  return db.heartRateSamples.where('source').equals(source).toArray();
}
