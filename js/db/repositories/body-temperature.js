import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export const BODY_TEMPERATURE_SOURCE = Object.freeze({
  MANUAL: 'manual',
  BLE: 'ble',
});

/** Both sources here are MEASURED, never estimated — same "no third,
 *  camera-estimated source" contract as blood-pressure.js/spo2.js
 *  (a phone camera has no honest way to sense body temperature either). */
export async function recordBodyTemperatureSample({ temperatureCelsius, source }, db = getDb()) {
  const entry = { temperatureCelsius, source, recordedAt: nowIso() };
  const id = await db.temperatureSamples.add(entry);
  return { ...entry, id };
}

export async function listRecentBodyTemperatureSamples(limit = 50, db = getDb()) {
  return db.temperatureSamples.orderBy('recordedAt').reverse().limit(limit).toArray();
}
