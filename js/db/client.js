import Dexie from '../vendor/dexie.min.mjs';
import { defineSchema } from './schema.js';

export const DB_NAME = 'fit-fly';

/** Builds a fresh, independent Dexie instance — used by the app singleton
 *  below and directly by tests that want an isolated database per test. */
export function createDb(name = DB_NAME) {
  const db = new Dexie(name);
  defineSchema(db);
  return db;
}

let appDb = null;

/** The app-wide singleton database. Repositories default to this so screens
 *  never have to thread a `db` handle through every call. */
export function getDb() {
  if (!appDb) appDb = createDb();
  return appDb;
}
