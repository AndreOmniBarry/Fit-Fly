import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

// Deliberately named "Encrypted*" throughout — this repository only ever
// sees ciphertext. Encrypting/decrypting the actual payload is
// js/features/womens-health/cycle-log-view.js's job, once it has the
// PIN-derived key; this module has no idea what a "symptom" is.

export async function saveEncryptedCycleLog({ date, iv, cipherBytes }, db = getDb()) {
  const record = { date, iv, cipherBytes, updatedAt: nowIso() };
  await db.cycleLogs.put(record);
  return record;
}

export async function getEncryptedCycleLog(date, db = getDb()) {
  return db.cycleLogs.get(date);
}

export async function listAllEncryptedCycleLogs(db = getDb()) {
  return db.cycleLogs.orderBy('date').toArray();
}

export async function deleteEncryptedCycleLog(date, db = getDb()) {
  await db.cycleLogs.delete(date);
}

/** The PIN-reset escape hatch — see js/features/womens-health/pin.js.
 *  Forgetting the PIN makes the data unrecoverable by design; this is
 *  the honest way out of that, not a workaround for it. */
export async function deleteAllCycleLogs(db = getDb()) {
  await db.cycleLogs.clear();
}
