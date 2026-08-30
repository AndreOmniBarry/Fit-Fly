import { getDb } from '../client.js';

export async function getSetting(key, db = getDb()) {
  const row = await db.settings.get(key);
  return row?.value;
}

export async function setSetting(key, value, db = getDb()) {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key, db = getDb()) {
  await db.settings.delete(key);
}
