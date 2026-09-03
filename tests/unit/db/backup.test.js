import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { BACKUP_VERSION, exportBackup, importBackup } from '../../../js/db/backup.js';
import { saveProfile } from '../../../js/db/repositories/profile.js';
import { saveEncryptedCycleLog, listAllEncryptedCycleLogs } from '../../../js/db/repositories/cycle-logs.js';
import { setSetting, getSetting } from '../../../js/db/repositories/settings.js';

/** A minimal in-memory localStorage stand-in — the plain 'node' Vitest
 *  environment has no real one (see vitest.config.js), and adding jsdom
 *  just for this would be a heavy dependency for one test file. Good
 *  enough to exercise listPrefs()/restorePrefs()'s real code path rather
 *  than letting their own try/catch silently no-op every prefs assertion
 *  here. */
function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    key: (i) => Array.from(store.keys())[i] ?? null,
    clear: () => store.clear(),
  };
}

describe('backup: exportBackup / importBackup', () => {
  let db;

  beforeEach(() => {
    db = createDb(`backup-test-${Math.random()}`);
    installFakeLocalStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('round-trips plain rows across every table untouched', async () => {
    await saveProfile({ id: 'primary', birthdate: '1990-01-01', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }, db);

    const backup = await exportBackup(db);
    expect(backup.app).toBe('fit-fly');
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.tables.profile).toHaveLength(1);
    expect(backup.tables.profile[0].id).toBe('primary');

    const freshDb = createDb(`backup-restore-test-${Math.random()}`);
    await importBackup(backup, freshDb);
    const restored = await freshDb.table('profile').get('primary');
    expect(restored.birthdate).toBe('1990-01-01');
  });

  it('round-trips binary fields (encrypted cycle logs) through base64 without any data loss', async () => {
    const iv = new Uint8Array([255, 0, 128, 12, 1, 2, 3, 4, 5, 6, 7, 8]);
    const cipherBytes = new Uint8Array([0, 255, 17, 200]);
    await saveEncryptedCycleLog({ date: '2026-08-02', iv, cipherBytes }, db);

    const backup = await exportBackup(db);
    // Serializes cleanly through real JSON, not just structuredClone —
    // this is what actually happens on export (JSON.stringify to a file)
    // and import (JSON.parse from one).
    const roundTripped = JSON.parse(JSON.stringify(backup));

    const freshDb = createDb(`backup-restore-cycle-${Math.random()}`);
    await importBackup(roundTripped, freshDb);
    const [restored] = await listAllEncryptedCycleLogs(freshDb);
    expect(restored.iv).toBeInstanceOf(Uint8Array);
    expect(restored.cipherBytes).toBeInstanceOf(Uint8Array);
    expect(restored.iv).toEqual(iv);
    expect(restored.cipherBytes).toEqual(cipherBytes);
  });

  it('round-trips the settings store, including nested binary (the PIN verifier)', async () => {
    const verifier = { salt: new Uint8Array([1, 2, 3]), iv: new Uint8Array([4, 5]), cipherBytes: new Uint8Array([9, 9]) };
    await setSetting('womensHealthPinVerifier', verifier, db);

    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const freshDb = createDb(`backup-restore-settings-${Math.random()}`);
    await importBackup(backup, freshDb);
    expect(await getSetting('womensHealthPinVerifier', freshDb)).toEqual(verifier);
  });

  it('round-trips prefs alongside the Dexie tables', async () => {
    localStorage.setItem('fitfly:stepsGoal', '10000');
    localStorage.setItem('fitfly:theme', 'dark');

    const backup = await exportBackup(db);
    expect(backup.prefs).toEqual({ stepsGoal: '10000', theme: 'dark' });

    localStorage.clear();
    await importBackup(backup, db);
    expect(localStorage.getItem('fitfly:stepsGoal')).toBe('10000');
    expect(localStorage.getItem('fitfly:theme')).toBe('dark');
  });

  it('import replaces (not merges) a table the backup does include', async () => {
    await saveEncryptedCycleLog({ date: '2026-01-01', iv: new Uint8Array([1]), cipherBytes: new Uint8Array([1]) }, db);
    const backup = await exportBackup(db); // captures just that one entry

    await saveEncryptedCycleLog({ date: '2026-02-02', iv: new Uint8Array([2]), cipherBytes: new Uint8Array([2]) }, db);
    expect(await listAllEncryptedCycleLogs(db)).toHaveLength(2);

    await importBackup(backup, db);
    const after = await listAllEncryptedCycleLogs(db);
    expect(after).toHaveLength(1);
    expect(after[0].date).toBe('2026-01-01');
  });

  it('leaves a table completely untouched when the backup never mentions it', async () => {
    await saveEncryptedCycleLog({ date: '2026-01-01', iv: new Uint8Array([1]), cipherBytes: new Uint8Array([1]) }, db);

    const backup = await exportBackup(db);
    delete backup.tables.cycleLogs; // simulate an older/partial backup file

    await importBackup(backup, db);
    // Untouched, not wiped, just because this backup was silent on it.
    expect(await listAllEncryptedCycleLogs(db)).toHaveLength(1);
  });

  it('rejects a file that is not a Fit Fly backup', async () => {
    await expect(importBackup(null, db)).rejects.toThrow('not a Fit Fly backup');
    await expect(importBackup({}, db)).rejects.toThrow('not a Fit Fly backup');
    await expect(importBackup({ app: 'some-other-app', tables: {} }, db)).rejects.toThrow('not a Fit Fly backup');
  });

  it('rejects a backup made by a newer version of the app', async () => {
    const backup = await exportBackup(db);
    backup.version = BACKUP_VERSION + 1;
    await expect(importBackup(backup, db)).rejects.toThrow('newer version');
  });
});
