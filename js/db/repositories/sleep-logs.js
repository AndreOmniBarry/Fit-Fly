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
//# sourceMappingURL=sleep-logs.js.map