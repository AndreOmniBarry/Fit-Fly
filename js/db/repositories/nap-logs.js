// Naps: a second, distinct session from the night's own sleepLogs entry —
// see js/db/schema.js's v18 comment for why this is its own store rather
// than a field on sleepLogs. Several real entries can exist for the same
// `date` (someone naps more than once), so this follows the same
// "multiple entries per day, own generated id" shape as
// hydration.js/nutrition's own repositories, not sleepLogs' "one row per
// date" shape.
import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
export async function saveNapLog(input, db = getDb()) {
    const record = {
        id: generateId(),
        date: input.date ?? todayIsoDate(),
        startTime: input.startTime,
        endTime: input.endTime,
        durationMinutes: input.durationMinutes,
        loggedAt: nowIso(),
    };
    await db.napLogs.add(record);
    return record;
}
/** Every nap logged for one date, oldest-first — the dashboard's own
 *  "naps logged today" summary. Usually 0 or 1, but a second (or third)
 *  real nap the same day is a real thing this supports, not an edge case
 *  to reject. */
export async function listNapLogsForDate(date, db = getDb()) {
    return db.napLogs.where('date').equals(date).sortBy('loggedAt');
}
/** Every nap within an inclusive [startDate, endDate] range, unordered —
 *  History's one query per visible month, same contract as
 *  listSleepLogsInRange. */
export async function listNapLogsInRange(startDate, endDate, db = getDb()) {
    return db.napLogs.where('date').between(startDate, endDate, true, true).toArray();
}
/** Every nap ever logged, unbounded — same "whole history, not a recent
 *  window" contract as listAllSleepLogs, used for the debt window's own
 *  nap-credit lookup (js/features/sleep/nap-debt.ts) since that window's
 *  dates aren't known ahead of the query. */
export async function listAllNapLogs(db = getDb()) {
    return db.napLogs.toArray();
}
export async function deleteNapLog(id, db = getDb()) {
    await db.napLogs.delete(id);
}
/** Sums a set of naps' durations — an empty set sums to 0 (a real,
 *  displayable "no naps yet" state), same contract as
 *  sumHydrationEntries. */
export function sumNapMinutes(naps) {
    return naps.reduce((total, n) => total + (n.durationMinutes ?? 0), 0);
}
//# sourceMappingURL=nap-logs.js.map