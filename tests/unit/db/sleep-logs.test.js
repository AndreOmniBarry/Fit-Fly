import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { getSleepLogForDate, listRecentSleepLogs, saveSleepLog } from '../../../js/db/repositories/sleep-logs.js';

describe('sleep-logs repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`sleep-logs-test-${Math.random()}`);
  });

  it('is keyed by date — a second save for tonight overwrites, not duplicates', async () => {
    await saveSleepLog({ date: '2026-08-01', bedTime: null, wakeTime: null, durationMinutes: 400, quality: 3, notes: '' }, db);
    await saveSleepLog({ date: '2026-08-01', bedTime: null, wakeTime: null, durationMinutes: 480, quality: 5, notes: '' }, db);

    expect(await listRecentSleepLogs(10, db)).toHaveLength(1);
    const stored = await getSleepLogForDate('2026-08-01', db);
    expect(stored.durationMinutes).toBe(480);
  });

  it('stamps loggedAt automatically', async () => {
    const saved = await saveSleepLog({ date: '2026-08-01', bedTime: null, wakeTime: null, durationMinutes: 420, quality: null, notes: '' }, db);
    expect(saved.loggedAt).toBeTruthy();
  });

  it('lists recent logs newest first', async () => {
    await saveSleepLog({ date: '2026-08-01', bedTime: null, wakeTime: null, durationMinutes: 400, quality: null, notes: '' }, db);
    await saveSleepLog({ date: '2026-08-03', bedTime: null, wakeTime: null, durationMinutes: 460, quality: null, notes: '' }, db);
    const recent = await listRecentSleepLogs(10, db);
    expect(recent.map((r) => r.date)).toEqual(['2026-08-03', '2026-08-01']);
  });

  it('is undefined for a date with no log', async () => {
    expect(await getSleepLogForDate('2026-08-01', db)).toBeUndefined();
  });
});
