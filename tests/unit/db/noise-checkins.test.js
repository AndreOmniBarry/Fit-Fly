import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  listAllNoiseCheckIns,
  listRecentNoiseCheckIns,
  recordNoiseCheckIn,
} from '../../../js/db/repositories/noise-checkins.js';

describe('noise check-ins repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`noise-checkins-test-${Math.random()}`);
  });

  it('is empty before anything is logged', async () => {
    expect(await listRecentNoiseCheckIns(50, db)).toEqual([]);
  });

  it('records a check-in with a real timestamp', async () => {
    const entry = await recordNoiseCheckIn({ estimatedDb: 72, category: 'loud' }, db);
    expect(entry.estimatedDb).toBe(72);
    expect(entry.category).toBe('loud');
    expect(typeof entry.recordedAt).toBe('string');
    expect(Number.isNaN(Date.parse(entry.recordedAt))).toBe(false);
    expect(typeof entry.id).toBe('number');
  });

  it('listRecentNoiseCheckIns returns newest first', async () => {
    await recordNoiseCheckIn({ estimatedDb: 60, category: 'moderate' }, db);
    await recordNoiseCheckIn({ estimatedDb: 90, category: 'harmful' }, db);
    const recent = await listRecentNoiseCheckIns(50, db);
    expect(recent.map((c) => c.estimatedDb)).toEqual([90, 60]);
  });

  it('listAllNoiseCheckIns is unbounded, unlike the recent-window query', async () => {
    for (let i = 0; i < 5; i++) {
      await recordNoiseCheckIn({ estimatedDb: 50 + i, category: 'quiet' }, db);
    }
    expect(await listAllNoiseCheckIns(db)).toHaveLength(5);
    expect(await listRecentNoiseCheckIns(2, db)).toHaveLength(2);
  });
});
