import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { clearProfile, getProfile, saveProfile } from '../../../js/db/repositories/profile.js';

describe('profile repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`profile-test-${Math.random()}`);
  });

  it('is empty before onboarding writes anything', async () => {
    expect(await getProfile(db)).toBeUndefined();
  });

  it('creates the profile on first save, stamping createdAt and updatedAt', async () => {
    const saved = await saveProfile({ heightCm: 170, weightKg: 68 }, db);
    expect(saved.id).toBe('primary');
    expect(saved.heightCm).toBe(170);
    expect(saved.createdAt).toBeTruthy();
    expect(saved.updatedAt).toBe(saved.createdAt);
  });

  it('merges a later save onto the existing record without dropping fields', async () => {
    const first = await saveProfile({ heightCm: 170, weightKg: 68 }, db);
    const second = await saveProfile({ weightKg: 66 }, db);

    expect(second.heightCm).toBe(170); // untouched field survives
    expect(second.weightKg).toBe(66); // updated field changed
    expect(second.createdAt).toBe(first.createdAt); // createdAt is stable
    expect(second.updatedAt >= first.updatedAt).toBe(true);

    expect(await getProfile(db)).toEqual(second);
  });

  it('clearProfile removes the record entirely', async () => {
    await saveProfile({ heightCm: 170 }, db);
    await clearProfile(db);
    expect(await getProfile(db)).toBeUndefined();
  });
});
