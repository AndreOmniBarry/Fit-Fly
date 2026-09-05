import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  addMonitorSample,
  finishMonitorSession,
  listAllMonitorSessions,
  listRecentMonitorSessions,
  listSamplesForSession,
  startMonitorSession,
} from '../../../js/db/repositories/noise-monitor.js';

describe('noise monitor repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`noise-monitor-test-${Math.random()}`);
  });

  it('starts a session with a real startedAt and no endedAt yet', async () => {
    const session = await startMonitorSession(db);
    expect(typeof session.id).toBe('string');
    expect(Number.isNaN(Date.parse(session.startedAt))).toBe(false);
    expect(session.endedAt).toBeNull();
  });

  it('an unfinished session stays honestly distinguishable from a finished one', async () => {
    const session = await startMonitorSession(db);
    const [before] = await listAllMonitorSessions(db);
    expect(before.endedAt).toBeNull();

    await finishMonitorSession(session.id, { dosePercent: 12.5, twaDb: 78, totalHours: 0.5, spikeCount: 1 }, db);
    const [after] = await listAllMonitorSessions(db);
    expect(after.endedAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(after.endedAt))).toBe(false);
    expect(after.dosePercent).toBe(12.5);
    expect(after.twaDb).toBe(78);
    expect(after.spikeCount).toBe(1);
  });

  it('adds samples scoped to their own session', async () => {
    const sessionA = await startMonitorSession(db);
    const sessionB = await startMonitorSession(db);
    await addMonitorSample(sessionA.id, { estimatedDb: 60, category: 'moderate', recordedAt: '2026-03-15T09:00:00Z' }, db);
    await addMonitorSample(sessionA.id, { estimatedDb: 90, category: 'harmful', recordedAt: '2026-03-15T09:01:00Z' }, db);
    await addMonitorSample(sessionB.id, { estimatedDb: 40, category: 'quiet', recordedAt: '2026-03-15T09:00:00Z' }, db);

    const samplesA = await listSamplesForSession(sessionA.id, db);
    expect(samplesA.map((s) => s.estimatedDb)).toEqual([60, 90]); // sorted oldest first
    const samplesB = await listSamplesForSession(sessionB.id, db);
    expect(samplesB).toHaveLength(1);
  });

  it('listRecentMonitorSessions returns newest first, listAllMonitorSessions is unbounded', async () => {
    for (let i = 0; i < 5; i++) {
      const session = await startMonitorSession(db);
      // stagger real startedAt so ordering is deterministic
      await db.noiseMonitorSessions.update(session.id, { startedAt: `2026-03-1${i}T00:00:00.000Z` });
    }
    const recent = await listRecentMonitorSessions(2, db);
    expect(recent).toHaveLength(2);
    expect(recent[0].startedAt > recent[1].startedAt).toBe(true);
    expect(await listAllMonitorSessions(db)).toHaveLength(5);
  });
});
