import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** Creates a session and, if provided, its sets in one transaction — a
 *  session with only some of its sets recorded would corrupt volume/PR
 *  history, so this never partially succeeds. */
export async function createSession({ sets = [], ...session }, db = getDb()) {
  const sessionRecord = {
    ...session,
    id: session.id ?? generateId(),
    startedAt: session.startedAt ?? nowIso(),
  };

  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.put(sessionRecord);
    if (sets.length > 0) {
      await db.sets.bulkAdd(
        sets.map((set) => ({ ...set, sessionId: sessionRecord.id }))
      );
    }
  });

  return sessionRecord;
}

export async function getSession(id, db = getDb()) {
  return db.sessions.get(id);
}

export async function addSet(sessionId, set, db = getDb()) {
  const record = {
    ...set,
    sessionId,
    completedAt: set.completedAt ?? nowIso(),
  };
  const id = await db.sets.add(record);
  return { ...record, id };
}

export async function listSetsForSession(sessionId, db = getDb()) {
  return db.sets.where('sessionId').equals(sessionId).sortBy('completedAt');
}

/** Every recorded set for one exercise, most recent first — the basis for
 *  PR tracking and volume trends. */
export async function listSetsForExercise(exerciseId, db = getDb()) {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  return sets.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function listSessionsByType(type, db = getDb()) {
  return db.sessions.where('type').equals(type).sortBy('startedAt');
}

/** Every session logged against one program — the basis for Programs'
 *  own calendar view (js/features/programs/program-calendar.js): which
 *  real calendar days had activity, and how this week's count compares
 *  to the program's own weekly training-day target. */
export async function listSessionsForProgram(programId, db = getDb()) {
  return db.sessions.where('programId').equals(programId).sortBy('startedAt');
}

export async function listRecentSessions(limit = 20, db = getDb()) {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
}

/** Every logged session, unbounded — the basis for a real lifetime
 *  "workouts completed" count (Badges), same "personal bests/lifetime
 *  totals come from the whole history, not a recent window" contract as
 *  Run's own listAllRuns(). */
export async function listAllSessions(db = getDb()) {
  return db.sessions.toArray();
}
