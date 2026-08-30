/** App-generated primary keys for records that need to be referenced from
 *  elsewhere (programs, sessions, exercises, ...) — auto-increment log/
 *  time-series stores (categoryAssignments, injuryScreens, sets) use
 *  Dexie's own ++id instead and don't need this. */
export function generateId() {
  return crypto.randomUUID();
}

/** ISO 8601 UTC "now" — the timestamp format used across every store. */
export function nowIso() {
  return new Date().toISOString();
}
