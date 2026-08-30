import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  getReadinessCheckinForDate,
  listRecentReadinessCheckins,
  saveReadinessCheckin,
} from '../../../js/db/repositories/readiness.js';

describe('readiness repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`readiness-test-${Math.random()}`);
  });

  it('is keyed by date — a second save for today overwrites, not duplicates', async () => {
    await saveReadinessCheckin({ date: '2026-08-01', sleepHours: 6, score: 60, category: 'moderate' }, db);
    await saveReadinessCheckin({ date: '2026-08-01', sleepHours: 8, score: 85, category: 'high' }, db);

    expect(await listRecentReadinessCheckins(10, db)).toHaveLength(1);
    const stored = await getReadinessCheckinForDate('2026-08-01', db);
    expect(stored.score).toBe(85);
  });

  it('stamps checkedAt automatically', async () => {
    const saved = await saveReadinessCheckin({ date: '2026-08-01', score: 70 }, db);
    expect(saved.checkedAt).toBeTruthy();
  });

  it('lists recent check-ins newest first', async () => {
    await saveReadinessCheckin({ date: '2026-08-01', score: 60 }, db);
    await saveReadinessCheckin({ date: '2026-08-03', score: 80 }, db);
    const recent = await listRecentReadinessCheckins(10, db);
    expect(recent.map((r) => r.date)).toEqual(['2026-08-03', '2026-08-01']);
  });

  it('is undefined for a date with no check-in', async () => {
    expect(await getReadinessCheckinForDate('2026-08-01', db)).toBeUndefined();
  });
});
