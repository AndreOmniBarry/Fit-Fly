import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const HR_SOURCE = Object.freeze({
  CAMERA_PPG: 'camera-ppg',
  MANUAL: 'manual',
  BLE: 'ble',
});

/** confidence is only meaningful (and only ever set) for camera-ppg
 *  readings — a manual entry or a real BLE strap reading is MEASURED,
 *  not an estimate, so there's nothing to grade.
 *
 *  rmssdMs is a plain, unindexed extra field (same pattern as
 *  sessions.js's own sessionRpe — see js/features/programs/
 *  training-load.js's doc comment for why: nothing queries samples *by*
 *  rmssdMs, so it needs no schema bump, no index). Only ever a real
 *  RMSSD computed from a connected BLE strap's own RR-intervals (see
 *  js/features/heart-rate/hrv.js's calculateRmssd and hrv-baseline.js) —
 *  camera-PPG and manual entries have no RR-intervals to derive it from
 *  at all, so this stays null for every source but 'ble'. */
export async function recordHeartRateSample({ bpm, source, confidence = null, sessionId = null, rmssdMs = null }, db = getDb()) {
  const entry = { bpm, source, confidence, sessionId, rmssdMs, recordedAt: nowIso() };
  const id = await db.heartRateSamples.add(entry);
  return { ...entry, id };
}

export async function listRecentHeartRateSamples(limit = 50, db = getDb()) {
  return db.heartRateSamples.orderBy('recordedAt').reverse().limit(limit).toArray();
}

export async function listHeartRateSamplesBySource(source, db = getDb()) {
  return db.heartRateSamples.where('source').equals(source).toArray();
}
