import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** One row per completed guided meditation or breathwork session — the
 *  same session id logged as many times as it's actually played. */
export async function recordMeditationSession({ sessionId, sessionName, durationSeconds }, db = getDb()) {
  const entry = {
    id: generateId(),
    sessionId,
    sessionName,
    durationSeconds,
    date: todayIsoDate(),
    completedAt: nowIso(),
  };
  await db.meditationSessions.add(entry);
  return entry;
}

export async function listRecentMeditationSessions(limit = 200, db = getDb()) {
  return db.meditationSessions.orderBy('completedAt').reverse().limit(limit).toArray();
}
