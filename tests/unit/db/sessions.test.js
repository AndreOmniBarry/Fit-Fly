import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  addSet,
  createSession,
  getSession,
  listRecentSessions,
  listSessionsByType,
  listSetsForExercise,
  listSetsForSession,
} from '../../../js/db/repositories/sessions.js';

describe('sessions + sets repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`sessions-test-${Math.random()}`);
  });

  it('creates a session with its sets in one transaction', async () => {
    const session = await createSession(
      {
        type: 'strength',
        sets: [
          { exerciseId: 'goblet-squat', reps: 10, weightKg: 16, completedAt: '2026-08-01T10:00:00.000Z' },
          { exerciseId: 'goblet-squat', reps: 8, weightKg: 18, completedAt: '2026-08-01T10:05:00.000Z' },
        ],
      },
      db
    );

    expect(await getSession(session.id, db)).toBeTruthy();
    const sets = await listSetsForSession(session.id, db);
    expect(sets).toHaveLength(2);
    expect(sets.every((s) => s.sessionId === session.id)).toBe(true);
  });

  it('creating a session with no sets is fine (e.g. a rest-day check-in)', async () => {
    const session = await createSession({ type: 'rest' }, db);
    expect(await listSetsForSession(session.id, db)).toEqual([]);
  });

  it('addSet appends to an existing session', async () => {
    const session = await createSession({ type: 'strength' }, db);
    await addSet(session.id, { exerciseId: 'push-up', reps: 15 }, db);
    await addSet(session.id, { exerciseId: 'push-up', reps: 12 }, db);

    expect(await listSetsForSession(session.id, db)).toHaveLength(2);
  });

  it('listSetsForExercise pulls sets across sessions, most recent first', async () => {
    await createSession(
      {
        type: 'strength',
        sets: [{ exerciseId: 'deadlift', reps: 5, weightKg: 100, completedAt: '2026-08-01T10:00:00.000Z' }],
      },
      db
    );
    await createSession(
      {
        type: 'strength',
        sets: [{ exerciseId: 'deadlift', reps: 5, weightKg: 105, completedAt: '2026-08-03T10:00:00.000Z' }],
      },
      db
    );

    const sets = await listSetsForExercise('deadlift', db);
    expect(sets.map((s) => s.weightKg)).toEqual([105, 100]);
  });

  it('listSessionsByType and listRecentSessions filter/order correctly', async () => {
    await createSession({ type: 'strength', startedAt: '2026-08-01T09:00:00.000Z' }, db);
    await createSession({ type: 'run', startedAt: '2026-08-02T09:00:00.000Z' }, db);
    await createSession({ type: 'strength', startedAt: '2026-08-03T09:00:00.000Z' }, db);

    expect(await listSessionsByType('run', db)).toHaveLength(1);
    expect((await listSessionsByType('strength', db)).map((s) => s.startedAt)).toEqual([
      '2026-08-01T09:00:00.000Z',
      '2026-08-03T09:00:00.000Z',
    ]);

    const recent = await listRecentSessions(2, db);
    expect(recent.map((s) => s.startedAt)).toEqual([
      '2026-08-03T09:00:00.000Z',
      '2026-08-02T09:00:00.000Z',
    ]);
  });
});
