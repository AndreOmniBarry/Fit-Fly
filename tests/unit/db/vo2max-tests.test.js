import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { listRecentVo2maxTests, recordVo2maxTest } from '../../../js/db/repositories/vo2max-tests.js';

describe('vo2max-tests repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`vo2max-test-${Math.random()}`);
  });

  it('records a Cooper test with its real inputs alongside the estimate', async () => {
    const entry = await recordVo2maxTest(
      { vo2max: 42.4, protocol: 'cooper', inputs: { distanceMeters: 2400 } },
      db
    );
    expect(entry.vo2max).toBe(42.4);
    expect(entry.protocol).toBe('cooper');
    expect(entry.inputs).toEqual({ distanceMeters: 2400 });
    expect(entry.recordedAt).toBeTruthy();
  });

  it('records a Rockport test with its real inputs', async () => {
    const entry = await recordVo2maxTest(
      {
        vo2max: 38.1,
        protocol: 'rockport',
        inputs: { weightKg: 70, ageYears: 30, sex: 'male', timeMinutes: 13, heartRateBpm: 140 },
      },
      db
    );
    expect(entry.protocol).toBe('rockport');
    expect(entry.inputs.heartRateBpm).toBe(140);
  });

  it('lists recent tests newest first', async () => {
    await recordVo2maxTest({ vo2max: 40, protocol: 'cooper', inputs: { distanceMeters: 2350 } }, db);
    await recordVo2maxTest({ vo2max: 42, protocol: 'cooper', inputs: { distanceMeters: 2440 } }, db);
    const recent = await listRecentVo2maxTests(10, db);
    expect(recent.map((t) => t.vo2max)).toEqual([42, 40]);
  });
});
