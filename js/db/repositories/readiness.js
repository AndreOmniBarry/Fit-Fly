import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

export async function saveReadinessCheckin(checkin, db = getDb()) {
  const record = { ...checkin, checkedAt: nowIso() };
  await db.readinessCheckins.put(record);
  return record;
}

export async function getReadinessCheckinForDate(date, db = getDb()) {
  return db.readinessCheckins.get(date);
}

export async function listRecentReadinessCheckins(limit = 14, db = getDb()) {
  return db.readinessCheckins.orderBy('date').reverse().limit(limit).toArray();
}
