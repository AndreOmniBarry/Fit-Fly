import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const SPO2_SOURCE = Object.freeze({
  MANUAL: 'manual',
  BLE: 'ble',
});

/** Both sources here are MEASURED, never estimated — a phone camera
 *  cannot honestly estimate blood oxygen at all (real pulse oximetry
 *  needs calibrated red + infrared wavelengths a phone camera doesn't
 *  have, unlike heart rate's green-channel PPG), so there's no third,
 *  camera-based source here the way there is for heart rate. */
export async function recordSpo2Sample({ spo2, pulseRate = null, source }, db = getDb()) {
  const entry = { spo2, pulseRate, source, recordedAt: nowIso() };
  const id = await db.spo2Samples.add(entry);
  return { ...entry, id };
}

export async function listRecentSpo2Samples(limit = 50, db = getDb()) {
  return db.spo2Samples.orderBy('recordedAt').reverse().limit(limit).toArray();
}
