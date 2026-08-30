import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  deleteAllCycleLogs,
  deleteEncryptedCycleLog,
  getEncryptedCycleLog,
  listAllEncryptedCycleLogs,
  saveEncryptedCycleLog,
} from '../../../js/db/repositories/cycle-logs.js';
import { getSetting, setSetting } from '../../../js/db/repositories/settings.js';

describe('cycle-logs repository (ciphertext only, no crypto here)', () => {
  let db;

  beforeEach(() => {
    db = createDb(`cycle-logs-test-${Math.random()}`);
  });

  it('is keyed by date, so a second save for the same date overwrites, not duplicates', async () => {
    const iv1 = new Uint8Array([1, 2, 3]);
    const cipherBytes1 = new Uint8Array([9, 9, 9]);
    await saveEncryptedCycleLog({ date: '2026-08-01', iv: iv1, cipherBytes: cipherBytes1 }, db);

    const iv2 = new Uint8Array([4, 5, 6]);
    const cipherBytes2 = new Uint8Array([7, 7, 7]);
    await saveEncryptedCycleLog({ date: '2026-08-01', iv: iv2, cipherBytes: cipherBytes2 }, db);

    expect(await listAllEncryptedCycleLogs(db)).toHaveLength(1);
    const stored = await getEncryptedCycleLog('2026-08-01', db);
    expect(stored.cipherBytes).toEqual(cipherBytes2);
  });

  it('round-trips arbitrary binary iv/cipherBytes through IndexedDB intact', async () => {
    const iv = new Uint8Array([255, 0, 128, 12, 1, 2, 3, 4, 5, 6, 7, 8]);
    const cipherBytes = new Uint8Array([0, 255, 17, 200]);
    await saveEncryptedCycleLog({ date: '2026-08-02', iv, cipherBytes }, db);
    const stored = await getEncryptedCycleLog('2026-08-02', db);
    expect(stored.iv).toEqual(iv);
    expect(stored.cipherBytes).toEqual(cipherBytes);
  });

  it('lists all logs ordered by date', async () => {
    await saveEncryptedCycleLog({ date: '2026-08-05', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    await saveEncryptedCycleLog({ date: '2026-08-01', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    const all = await listAllEncryptedCycleLogs(db);
    expect(all.map((l) => l.date)).toEqual(['2026-08-01', '2026-08-05']);
  });

  it('deletes a single day, and deleteAllCycleLogs clears everything', async () => {
    await saveEncryptedCycleLog({ date: '2026-08-01', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    await saveEncryptedCycleLog({ date: '2026-08-02', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);

    await deleteEncryptedCycleLog('2026-08-01', db);
    expect(await listAllEncryptedCycleLogs(db)).toHaveLength(1);

    await deleteAllCycleLogs(db);
    expect(await listAllEncryptedCycleLogs(db)).toHaveLength(0);
  });
});

describe('settings repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`settings-test-${Math.random()}`);
  });

  it('is undefined for an unset key', async () => {
    expect(await getSetting('womensHealthPin', db)).toBeUndefined();
  });

  it('round-trips an arbitrary value, including nested binary data', async () => {
    const value = { salt: new Uint8Array([1, 2, 3]), iv: new Uint8Array([4, 5]), cipherBytes: new Uint8Array([9]) };
    await setSetting('womensHealthPin', value, db);
    expect(await getSetting('womensHealthPin', db)).toEqual(value);
  });

  it('a later set overwrites the same key', async () => {
    await setSetting('theme', 'dark', db);
    await setSetting('theme', 'light', db);
    expect(await getSetting('theme', db)).toBe('light');
  });
});
