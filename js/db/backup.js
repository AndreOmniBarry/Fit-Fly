// A full on-device backup: every Dexie table this schema currently
// defines, plus every stored preference (see js/lib/storage.js), folded
// into one plain JSON-serializable object. This is the entire point of
// export/import — there's no server this data could otherwise ever leave
// this device through, so a backup file is the only way to move it to a
// new phone, or just have a real copy that survives losing this one.
//
// Binary fields (only ever the women's-health PIN verifier in `settings`
// and the AES-GCM ciphertext + iv in `cycleLogs` — see js/lib/crypto.js)
// are base64-encoded here so the whole thing round-trips through
// JSON.stringify/parse untouched. That data stays exactly as opaque on
// the way out and back in as it already is at rest: this module has no
// idea what a Uint8Array it's encoding actually decrypts to, and neither
// export nor import ever needs the PIN.
import { getDb } from './client.js';
import { listPrefs, restorePrefs } from '../lib/storage.js';

export const BACKUP_VERSION = 1;
const APP_ID = 'fit-fly';

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Walks any JSON-shaped value, replacing every Uint8Array with a small
 *  tagged, base64-encoded stand-in. Recurses through plain objects/arrays
 *  only — Dexie rows here are never anything else. */
function encodeValue(value) {
  if (value instanceof Uint8Array) {
    return { __bytes: uint8ToBase64(value) };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = encodeValue(value[key]);
    return out;
  }
  return value;
}

function decodeValue(value) {
  if (value && typeof value === 'object' && typeof value.__bytes === 'string') {
    return base64ToUint8(value.__bytes);
  }
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = decodeValue(value[key]);
    return out;
  }
  return value;
}

/** Every row of every table this schema currently defines, plus every
 *  stored preference — everything on this device that isn't hand-authored
 *  app content (the exercise library rebuilds itself on next launch via
 *  seedExerciseLibrary(), so it's included too for simplicity but never
 *  the thing anyone actually needs restored). */
export async function exportBackup(db = getDb()) {
  const tables = {};
  for (const table of db.tables) {
    tables[table.name] = encodeValue(await table.toArray());
  }
  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    prefs: listPrefs(),
  };
}

/** Replaces this device's data with what's in `backup` — a real restore,
 *  not a merge, so the result is exactly the state of whatever was
 *  exported. A table this schema no longer knows about is silently
 *  skipped (a version drifted apart, not a reason to fail); a table this
 *  schema knows about but the backup doesn't mention is left completely
 *  untouched, never emptied out just because the backup is silent on it.
 *  All-or-nothing: if anything fails partway through, nothing in the
 *  database changes. */
export async function importBackup(backup, db = getDb()) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('This file is not a Fit Fly backup.');
  }
  if (backup.app !== APP_ID || typeof backup.tables !== 'object' || backup.tables === null) {
    throw new Error('This file is not a Fit Fly backup.');
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of Fit Fly than this one.');
  }

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = backup.tables[table.name];
      if (!Array.isArray(rows)) continue; // this backup never mentions this table — leave it alone
      await table.clear();
      if (rows.length > 0) await table.bulkPut(decodeValue(rows));
    }
  });

  restorePrefs(backup.prefs);
}
