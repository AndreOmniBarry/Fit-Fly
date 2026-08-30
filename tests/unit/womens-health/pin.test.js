import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { saveEncryptedCycleLog, listAllEncryptedCycleLogs } from '../../../js/db/repositories/cycle-logs.js';
import {
  getSessionKey,
  hasPinSet,
  isUnlocked,
  lock,
  resetForgottenPin,
  setUpPin,
  unlockWithPin,
} from '../../../js/features/womens-health/pin.js';

describe('pin', () => {
  let db;

  beforeEach(() => {
    db = createDb(`pin-test-${Math.random()}`);
    lock(); // the session key is module-level state — reset it between tests
  });

  it('starts locked with no PIN set', async () => {
    expect(await hasPinSet(db)).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it('setUpPin unlocks immediately and persists the verifier', async () => {
    const ok = await setUpPin('4242', db);
    expect(ok).toBe(true);
    expect(isUnlocked()).toBe(true);
    expect(getSessionKey()).not.toBeNull();
    expect(await hasPinSet(db)).toBe(true);
  });

  it('unlockWithPin succeeds with the right PIN and fails with the wrong one', async () => {
    await setUpPin('4242', db);
    lock();
    expect(isUnlocked()).toBe(false);

    expect(await unlockWithPin('0000', db)).toBe(false);
    expect(isUnlocked()).toBe(false);

    expect(await unlockWithPin('4242', db)).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it('unlockWithPin fails cleanly when no PIN has ever been set', async () => {
    expect(await unlockWithPin('anything', db)).toBe(false);
  });

  it('lock() clears the session key', async () => {
    await setUpPin('4242', db);
    lock();
    expect(isUnlocked()).toBe(false);
    expect(getSessionKey()).toBeNull();
  });

  it('resetForgottenPin deletes the PIN and every cycle log, and locks the session', async () => {
    await setUpPin('4242', db);
    await saveEncryptedCycleLog({ date: '2026-08-01', iv: new Uint8Array(), cipherBytes: new Uint8Array() }, db);

    await resetForgottenPin(db);

    expect(await hasPinSet(db)).toBe(false);
    expect(isUnlocked()).toBe(false);
    expect(await listAllEncryptedCycleLogs(db)).toHaveLength(0);
  });
});
