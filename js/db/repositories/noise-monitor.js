import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** A real "Monitor" session — see js/features/hearing/noise-monitor.js.
 *  `endedAt` starts unset; finishMonitorSession fills it in once the
 *  person actually stops the session, so an interrupted session (tab
 *  closed mid-monitor) is honestly distinguishable from a completed one. */
export async function startMonitorSession(db = getDb()) {
  const session = { id: generateId(), startedAt: nowIso(), endedAt: null };
  await db.noiseMonitorSessions.put(session);
  return session;
}

/** Caches this session's real dose/TWA/spike summary (already computed
 *  from its own raw samples by the caller — see
 *  js/features/hearing/hearing-exposure.js's summarizeSession) onto the
 *  session record itself, alongside the raw samples this was computed
 *  from. Not a shortcut around the real math: it's still derived
 *  entirely from real readings, just cached once at the point the
 *  session actually ends so a later exposure-over-time chart across
 *  many sessions doesn't need to re-fetch and re-sum every session's
 *  full sample history on every render. */
export async function finishMonitorSession(sessionId, { dosePercent, twaDb, totalHours, spikeCount }, db = getDb()) {
  await db.noiseMonitorSessions.update(sessionId, {
    endedAt: nowIso(),
    dosePercent,
    twaDb,
    totalHours,
    spikeCount,
  });
}

export async function addMonitorSample(sessionId, { estimatedDb, category, recordedAt }, db = getDb()) {
  const sample = { sessionId, estimatedDb, category, recordedAt: recordedAt ?? nowIso() };
  const id = await db.noiseMonitorSamples.add(sample);
  return { ...sample, id };
}

export async function listSamplesForSession(sessionId, db = getDb()) {
  return db.noiseMonitorSamples.where('sessionId').equals(sessionId).sortBy('recordedAt');
}

export async function listRecentMonitorSessions(limit = 30, db = getDb()) {
  return db.noiseMonitorSessions.orderBy('startedAt').reverse().limit(limit).toArray();
}

/** Every monitor session ever run, unbounded — the basis for a real
 *  exposure-over-time chart across D/W/M/6M/Y ranges (see
 *  js/lib/time-range.js), same "the whole history, not a recent window"
 *  contract as every other lifetime view in this app. */
export async function listAllMonitorSessions(db = getDb()) {
  return db.noiseMonitorSessions.toArray();
}
