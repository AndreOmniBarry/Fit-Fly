import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

// Deliberately named "Encrypted*" throughout, same convention as
// cycle-logs.js/pregnancy.js — this repository only ever sees
// ciphertext. Encrypting/decrypting the actual payload (each item's 1-5
// rating) is js/features/womens-health/cycle-log-view.js's job, once it
// has the same PIN-derived key cycle/pregnancy tracking already use.

export async function saveEncryptedPmddSymptomLog({ date, iv, cipherBytes }, db = getDb()) {
  const record = { date, iv, cipherBytes, updatedAt: nowIso() };
  await db.pmddSymptomLogs.put(record);
  return record;
}

export async function getEncryptedPmddSymptomLog(date, db = getDb()) {
  return db.pmddSymptomLogs.get(date);
}

export async function listAllEncryptedPmddSymptomLogs(db = getDb()) {
  return db.pmddSymptomLogs.orderBy('date').toArray();
}

export async function deleteEncryptedPmddSymptomLog(date, db = getDb()) {
  await db.pmddSymptomLogs.delete(date);
}

/** The PIN-reset escape hatch — see js/features/womens-health/pin.js.
 *  Forgetting the PIN makes this data unrecoverable by design, same as
 *  cycle tracking's own deleteAllCycleLogs/deleteAllPregnancyData. */
export async function deleteAllPmddSymptomLogs(db = getDb()) {
  await db.pmddSymptomLogs.clear();
}
