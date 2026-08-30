import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** Runs are only ever written once complete — see schema.js's comment. */
export async function saveCompletedRun(run, db = getDb()) {
  const record = {
    ...run,
    id: run.id ?? generateId(),
    startedAt: run.startedAt ?? nowIso(),
  };
  await db.runs.put(record);
  return record;
}

export async function getRun(id, db = getDb()) {
  return db.runs.get(id);
}

export async function listRecentRuns(limit = 50, db = getDb()) {
  return db.runs.orderBy('startedAt').reverse().limit(limit).toArray();
}

export async function listAllRuns(db = getDb()) {
  return db.runs.toArray();
}
