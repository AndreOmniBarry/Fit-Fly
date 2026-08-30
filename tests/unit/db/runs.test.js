import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { getRun, listAllRuns, listRecentRuns, saveCompletedRun } from '../../../js/db/repositories/runs.js';

describe('runs repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`runs-test-${Math.random()}`);
  });

  it('saves a completed run with a generated id and default startedAt', async () => {
    const saved = await saveCompletedRun({ distanceMeters: 5000, durationMs: 1500000, route: [] }, db);
    expect(saved.id).toBeTruthy();
    expect(saved.startedAt).toBeTruthy();
    expect(await getRun(saved.id, db)).toEqual(saved);
  });

  it('embeds the route array on the run record itself', async () => {
    const route = [{ lat: 40.1, lon: -74.1, accuracyM: 8, tMs: 1000 }, { lat: 40.11, lon: -74.1, accuracyM: 9, tMs: 2000 }];
    const saved = await saveCompletedRun({ distanceMeters: 100, durationMs: 60000, route }, db);
    const fetched = await getRun(saved.id, db);
    expect(fetched.route).toEqual(route);
  });

  it('lists recent runs newest first', async () => {
    await saveCompletedRun({ distanceMeters: 1000, durationMs: 300000, route: [], startedAt: '2026-08-01T09:00:00.000Z' }, db);
    await saveCompletedRun({ distanceMeters: 2000, durationMs: 600000, route: [], startedAt: '2026-08-03T09:00:00.000Z' }, db);

    const recent = await listRecentRuns(10, db);
    expect(recent.map((r) => r.startedAt)).toEqual(['2026-08-03T09:00:00.000Z', '2026-08-01T09:00:00.000Z']);
  });

  it('listAllRuns returns every run regardless of order', async () => {
    await saveCompletedRun({ distanceMeters: 1000, durationMs: 300000, route: [] }, db);
    await saveCompletedRun({ distanceMeters: 2000, durationMs: 600000, route: [] }, db);
    expect(await listAllRuns(db)).toHaveLength(2);
  });
});
