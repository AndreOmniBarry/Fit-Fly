import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  deleteAllPregnancyData,
  deleteEncryptedPregnancySetup,
  getEncryptedPregnancyLog,
  getEncryptedPregnancySetup,
  listAllEncryptedPregnancyLogs,
  saveEncryptedPregnancyLog,
  saveEncryptedPregnancySetup,
} from '../../../js/db/repositories/pregnancy.js';

describe('pregnancy repository (ciphertext only, no crypto here)', () => {
  let db;

  beforeEach(() => {
    db = createDb(`pregnancy-test-${Math.random()}`);
  });

  it('setup is undefined before anything is saved', async () => {
    expect(await getEncryptedPregnancySetup(db)).toBeUndefined();
  });

  it('saveEncryptedPregnancySetup is a single row — a second save overwrites, not duplicates', async () => {
    const iv1 = new Uint8Array([1, 2, 3]);
    await saveEncryptedPregnancySetup({ iv: iv1, cipherBytes: new Uint8Array([9]) }, db);
    const iv2 = new Uint8Array([4, 5, 6]);
    await saveEncryptedPregnancySetup({ iv: iv2, cipherBytes: new Uint8Array([8]) }, db);

    const stored = await getEncryptedPregnancySetup(db);
    expect(stored.iv).toEqual(iv2);
  });

  it('deleteEncryptedPregnancySetup removes it', async () => {
    await saveEncryptedPregnancySetup({ iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    await deleteEncryptedPregnancySetup(db);
    expect(await getEncryptedPregnancySetup(db)).toBeUndefined();
  });

  it('logs are keyed by date, so a second save for the same date overwrites', async () => {
    await saveEncryptedPregnancyLog({ date: '2026-08-01', iv: new Uint8Array([1]), cipherBytes: new Uint8Array([1]) }, db);
    await saveEncryptedPregnancyLog({ date: '2026-08-01', iv: new Uint8Array([2]), cipherBytes: new Uint8Array([2]) }, db);

    expect(await listAllEncryptedPregnancyLogs(db)).toHaveLength(1);
    const stored = await getEncryptedPregnancyLog('2026-08-01', db);
    expect(stored.cipherBytes).toEqual(new Uint8Array([2]));
  });

  it('lists all logs ordered by date', async () => {
    await saveEncryptedPregnancyLog({ date: '2026-08-05', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    await saveEncryptedPregnancyLog({ date: '2026-08-01', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    const all = await listAllEncryptedPregnancyLogs(db);
    expect(all.map((l) => l.date)).toEqual(['2026-08-01', '2026-08-05']);
  });

  it('deleteAllPregnancyData clears both the setup row and every log', async () => {
    await saveEncryptedPregnancySetup({ iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);
    await saveEncryptedPregnancyLog({ date: '2026-08-01', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);

    await deleteAllPregnancyData(db);

    expect(await getEncryptedPregnancySetup(db)).toBeUndefined();
    expect(await listAllEncryptedPregnancyLogs(db)).toHaveLength(0);
  });
});
