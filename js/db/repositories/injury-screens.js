import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

/** Records one injury/pain screening answer set. `redFlags` is the list of
 *  matched red-flag prompts (e.g. "numbness/tingling", "chest pain") the
 *  safety-screening logic raised — an empty array means none matched. */
export async function recordInjuryScreen(
  { bodyArea, severity, redFlags = [], notes = '' },
  db = getDb()
) {
  const entry = {
    bodyArea,
    severity,
    redFlags,
    notes,
    screenedAt: nowIso(),
  };
  const id = await db.injuryScreens.add(entry);
  return { ...entry, id };
}

export async function listInjuryScreens(db = getDb()) {
  return db.injuryScreens.orderBy('screenedAt').reverse().toArray();
}

export async function listInjuryScreensForArea(bodyArea, db = getDb()) {
  return db.injuryScreens.where('bodyArea').equals(bodyArea).toArray();
}

/** Any screen still active (no explicit "cleared" follow-up recorded)
 *  that raised a red flag — the set of things program generation must
 *  route around or that should keep surfacing a caution banner. */
export async function listOpenRedFlags(db = getDb()) {
  const all = await db.injuryScreens.orderBy('screenedAt').toArray();
  return all.filter((entry) => entry.redFlags.length > 0);
}
