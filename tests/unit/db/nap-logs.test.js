import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  deleteNapLog,
  listAllNapLogs,
  listNapLogsForDate,
  listNapLogsInRange,
  saveNapLog,
  sumNapMinutes,
} from '../../../js/db/repositories/nap-logs.js';

describe('nap-logs repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`nap-logs-test-${Math.random()}`);
  });

  it('saves a nap with a real generated id and stamped loggedAt', async () => {
    const saved = await saveNapLog({ date: '2026-08-01', startTime: 't1', endTime: 't2', durationMinutes: 30 }, db);
    expect(saved.id).toBeTruthy();
    expect(saved.loggedAt).toBeTruthy();
    expect(saved.durationMinutes).toBe(30);
  });

  it('a second nap the same date does NOT overwrite the first — unlike sleepLogs, several real entries can coexist', async () => {
    await saveNapLog({ date: '2026-08-01', startTime: 't1', endTime: 't2', durationMinutes: 20 }, db);
    await saveNapLog({ date: '2026-08-01', startTime: 't3', endTime: 't4', durationMinutes: 40 }, db);

    const naps = await listNapLogsForDate('2026-08-01', db);
    expect(naps).toHaveLength(2);
    expect(naps.map((n) => n.durationMinutes).sort((a, b) => a - b)).toEqual([20, 40]);
  });

  it('a night log and a nap for the same date coexist independently', async () => {
    await db.sleepLogs.put({
      date: '2026-08-01',
      bedTime: null,
      wakeTime: null,
      durationMinutes: 420,
      quality: null,
      notes: '',
      loggedAt: '2026-08-01T07:00:00.000Z',
    });
    await saveNapLog({ date: '2026-08-01', startTime: 't1', endTime: 't2', durationMinutes: 30 }, db);

    const night = await db.sleepLogs.get('2026-08-01');
    const naps = await listNapLogsForDate('2026-08-01', db);
    expect(night.durationMinutes).toBe(420); // untouched by the nap
    expect(naps).toHaveLength(1);
    expect(naps[0].durationMinutes).toBe(30);
  });

  it('is empty for a date with no nap logged', async () => {
    expect(await listNapLogsForDate('2026-08-01', db)).toEqual([]);
  });

  it('listNapLogsInRange finds naps within an inclusive date range', async () => {
    await saveNapLog({ date: '2026-01-01', startTime: 't1', endTime: 't2', durationMinutes: 20 }, db);
    await saveNapLog({ date: '2026-01-15', startTime: 't1', endTime: 't2', durationMinutes: 25 }, db);
    await saveNapLog({ date: '2026-02-01', startTime: 't1', endTime: 't2', durationMinutes: 30 }, db);

    const inRange = await listNapLogsInRange('2026-01-01', '2026-01-31', db);
    expect(inRange.map((n) => n.date).sort()).toEqual(['2026-01-01', '2026-01-15']);
  });

  it('listAllNapLogs returns every nap ever, not just a recent window', async () => {
    await saveNapLog({ date: '2020-01-01', startTime: 't1', endTime: 't2', durationMinutes: 20 }, db);
    await saveNapLog({ date: '2026-08-01', startTime: 't1', endTime: 't2', durationMinutes: 30 }, db);
    const all = await listAllNapLogs(db);
    expect(all.map((n) => n.date).sort()).toEqual(['2020-01-01', '2026-08-01']);
  });

  it('deletes a nap by id', async () => {
    const saved = await saveNapLog({ date: '2026-08-01', startTime: 't1', endTime: 't2', durationMinutes: 20 }, db);
    await deleteNapLog(saved.id, db);
    expect(await listNapLogsForDate('2026-08-01', db)).toEqual([]);
  });
});

describe('sumNapMinutes', () => {
  it('sums to 0 for no naps, never null', () => {
    expect(sumNapMinutes([])).toBe(0);
  });

  it('sums real durations', () => {
    expect(sumNapMinutes([{ durationMinutes: 20 }, { durationMinutes: 30 }])).toBe(50);
  });
});
