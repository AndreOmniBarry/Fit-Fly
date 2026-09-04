import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

// Deliberately named "Encrypted*" throughout, same convention as
// cycle-logs.js — this repository only ever sees ciphertext. Encrypting/
// decrypting the actual payload (due date, symptoms, kick sessions) is
// js/features/womens-health/cycle-log-view.js's job, once it has the
// same PIN-derived key cycle tracking already uses.

const PREGNANCY_SETUP_ID = 'primary';

export async function saveEncryptedPregnancySetup({ iv, cipherBytes }, db = getDb()) {
  const record = { id: PREGNANCY_SETUP_ID, iv, cipherBytes, updatedAt: nowIso() };
  await db.pregnancySetup.put(record);
  return record;
}

export async function getEncryptedPregnancySetup(db = getDb()) {
  return db.pregnancySetup.get(PREGNANCY_SETUP_ID);
}

export async function deleteEncryptedPregnancySetup(db = getDb()) {
  await db.pregnancySetup.delete(PREGNANCY_SETUP_ID);
}

export async function saveEncryptedPregnancyLog({ date, iv, cipherBytes }, db = getDb()) {
  const record = { date, iv, cipherBytes, updatedAt: nowIso() };
  await db.pregnancyLogs.put(record);
  return record;
}

export async function getEncryptedPregnancyLog(date, db = getDb()) {
  return db.pregnancyLogs.get(date);
}

export async function listAllEncryptedPregnancyLogs(db = getDb()) {
  return db.pregnancyLogs.orderBy('date').toArray();
}

/** The PIN-reset escape hatch — see js/features/womens-health/pin.js.
 *  Forgetting the PIN makes this data unrecoverable by design, same as
 *  cycle tracking's own deleteAllCycleLogs. */
export async function deleteAllPregnancyData(db = getDb()) {
  await db.pregnancySetup.clear();
  await db.pregnancyLogs.clear();
}
