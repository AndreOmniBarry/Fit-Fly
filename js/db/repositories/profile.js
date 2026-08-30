import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

const PROFILE_ID = 'primary';

export async function getProfile(db = getDb()) {
  return db.profile.get(PROFILE_ID);
}

/** Merges `patch` onto the existing profile (or creates it). Never drops
 *  fields the caller didn't mention. */
export async function saveProfile(patch, db = getDb()) {
  const existing = await db.profile.get(PROFILE_ID);
  const now = nowIso();
  const record = {
    ...existing,
    ...patch,
    id: PROFILE_ID,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.profile.put(record);
  return record;
}

export async function clearProfile(db = getDb()) {
  await db.profile.delete(PROFILE_ID);
}
