import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';
import type { SleepLog } from '../../features/sleep/types.js';

export async function saveSleepLog(
  log: Omit<SleepLog, 'loggedAt'>,
  db = getDb()
): Promise<SleepLog> {
  const record: SleepLog = { ...log, loggedAt: nowIso() };
  await db.sleepLogs.put(record);
  return record;
}

export async function getSleepLogForDate(date: string, db = getDb()): Promise<SleepLog | undefined> {
  return db.sleepLogs.get(date);
}

/** Most recent nights first — the trailing window every pure-logic module
 *  (score/consistency/debt/trends) takes as input. Callers slice/reverse
 *  as needed; this just fetches. */
export async function listRecentSleepLogs(limit = 14, db = getDb()): Promise<SleepLog[]> {
  return db.sleepLogs.orderBy('date').reverse().limit(limit).toArray();
}

/** Every logged night between two dates (inclusive, both 'YYYY-MM-DD'),
 *  unordered — the History calendar's one query per visible month. Every
 *  other sleep query is a "most recent N" window; this is the one place
 *  a specific range matters, since a calendar month doesn't care how
 *  recent it is. */
export async function listSleepLogsInRange(
  startDate: string,
  endDate: string,
  db = getDb()
): Promise<SleepLog[]> {
  return db.sleepLogs.where('date').between(startDate, endDate, true, true).toArray();
}

export async function deleteSleepLog(date: string, db = getDb()): Promise<void> {
  await db.sleepLogs.delete(date);
}
