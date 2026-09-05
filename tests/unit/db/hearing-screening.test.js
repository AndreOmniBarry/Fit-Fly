import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { listHearingScreeningTests, saveHearingScreeningTest } from '../../../js/db/repositories/hearing-screening.js';

describe('hearing screening repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`hearing-screening-test-${Math.random()}`);
  });

  it('is empty before any test is completed', async () => {
    expect(await listHearingScreeningTests(db)).toEqual([]);
  });

  it('saves a whole test with its real results and a real completedAt', async () => {
    const results = [{ frequencyHz: 1000, ear: 'left', thresholdGain: 0.2 }];
    const test = await saveHearingScreeningTest(results, db);
    expect(test.results).toEqual(results);
    expect(Number.isNaN(Date.parse(test.completedAt))).toBe(false);
  });

  it('lists tests most recent first', async () => {
    const first = await saveHearingScreeningTest([{ frequencyHz: 1000, ear: 'left', thresholdGain: 0.1 }], db);
    await db.hearingScreeningTests.update(first.id, { completedAt: '2026-01-01T00:00:00.000Z' });
    const second = await saveHearingScreeningTest([{ frequencyHz: 1000, ear: 'left', thresholdGain: 0.2 }], db);
    await db.hearingScreeningTests.update(second.id, { completedAt: '2026-06-01T00:00:00.000Z' });

    const tests = await listHearingScreeningTests(db);
    expect(tests.map((t) => t.id)).toEqual([second.id, first.id]);
  });
});
