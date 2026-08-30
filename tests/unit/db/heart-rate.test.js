import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  HR_SOURCE,
  listHeartRateSamplesBySource,
  listRecentHeartRateSamples,
  recordHeartRateSample,
} from '../../../js/db/repositories/heart-rate.js';

describe('heart-rate repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`hr-test-${Math.random()}`);
  });

  it('records a camera-ppg sample with its confidence', async () => {
    const entry = await recordHeartRateSample({ bpm: 72, source: HR_SOURCE.CAMERA_PPG, confidence: 'medium' }, db);
    expect(entry.bpm).toBe(72);
    expect(entry.confidence).toBe('medium');
    expect(entry.recordedAt).toBeTruthy();
  });

  it('a manual entry has no confidence field set (measured, not estimated)', async () => {
    const entry = await recordHeartRateSample({ bpm: 65, source: HR_SOURCE.MANUAL }, db);
    expect(entry.confidence).toBeNull();
  });

  it('lists recent samples newest first', async () => {
    await recordHeartRateSample({ bpm: 70, source: HR_SOURCE.MANUAL }, db);
    await recordHeartRateSample({ bpm: 75, source: HR_SOURCE.MANUAL }, db);
    const recent = await listRecentHeartRateSamples(10, db);
    expect(recent.map((s) => s.bpm)).toEqual([75, 70]);
  });

  it('filters by source', async () => {
    await recordHeartRateSample({ bpm: 70, source: HR_SOURCE.MANUAL }, db);
    await recordHeartRateSample({ bpm: 74, source: HR_SOURCE.CAMERA_PPG, confidence: 'high' }, db);
    expect(await listHeartRateSamplesBySource(HR_SOURCE.CAMERA_PPG, db)).toHaveLength(1);
    expect(await listHeartRateSamplesBySource(HR_SOURCE.MANUAL, db)).toHaveLength(1);
  });
});
