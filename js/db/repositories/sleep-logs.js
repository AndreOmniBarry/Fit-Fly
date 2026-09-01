import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';
export async function saveSleepLog(log, db = getDb()) {
    const record = { ...log, loggedAt: nowIso() };
    await db.sleepLogs.put(record);
    return record;
}
export async function getSleepLogForDate(date, db = getDb()) {
    return db.sleepLogs.get(date);
}
/** Most recent nights first — the trailing window every pure-logic module
 *  (score/consistency/debt/trends) takes as input. Callers slice/reverse
 *  as needed; this just fetches. */
export async function listRecentSleepLogs(limit = 14, db = getDb()) {
    return db.sleepLogs.orderBy('date').reverse().limit(limit).toArray();
}
/** Every logged night between two dates (inclusive, both 'YYYY-MM-DD'),
 *  unordered — the History calendar's one query per visible month. Every
 *  other sleep query is a "most recent N" window; this is the one place
 *  a specific range matters, since a calendar month doesn't care how
 *  recent it is. */
export async function listSleepLogsInRange(startDate, endDate, db = getDb()) {
    return db.sleepLogs.where('date').between(startDate, endDate, true, true).toArray();
}
export async function deleteSleepLog(date, db = getDb()) {
    await db.sleepLogs.delete(date);
}
//# sourceMappingURL=sleep-logs.js.map