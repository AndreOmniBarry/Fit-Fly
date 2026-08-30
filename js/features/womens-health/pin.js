// PIN setup/unlock for the women's-health section, and the in-memory
// session key it derives. The derived AES-GCM key lives only in this
// module's memory for the life of the page — never in localStorage,
// IndexedDB, or anywhere else — so a reload always requires re-entering
// the PIN. That's a deliberate trade-off: convenience loses to actually
// protecting the data.

import { createPinVerifier, verifyPin } from '../../lib/crypto.js';
import { getDb } from '../../db/client.js';
import { deleteSetting, getSetting, setSetting } from '../../db/repositories/settings.js';
import { deleteAllCycleLogs } from '../../db/repositories/cycle-logs.js';

const SETTINGS_KEY = 'womensHealthPin';

let sessionKey = null;

export async function hasPinSet(db = getDb()) {
  return (await getSetting(SETTINGS_KEY, db)) != null;
}

export function isUnlocked() {
  return sessionKey != null;
}

export function getSessionKey() {
  return sessionKey;
}

export async function setUpPin(pin, db = getDb()) {
  const verifier = await createPinVerifier(pin);
  await setSetting(SETTINGS_KEY, verifier, db);
  sessionKey = await verifyPin(pin, verifier); // unlocked immediately after setup
  return sessionKey != null;
}

export async function unlockWithPin(pin, db = getDb()) {
  const verifier = await getSetting(SETTINGS_KEY, db);
  if (!verifier) return false;
  const key = await verifyPin(pin, verifier);
  if (!key) return false;
  sessionKey = key;
  return true;
}

export function lock() {
  sessionKey = null;
}

/** The only way out of a forgotten PIN — the cycle data it protected is
 *  genuinely unrecoverable without it, so "reset" here means deleting
 *  the PIN *and* every log it encrypted, never a backdoor around it. */
export async function resetForgottenPin(db = getDb()) {
  await deleteSetting(SETTINGS_KEY, db);
  await deleteAllCycleLogs(db);
  sessionKey = null;
}
