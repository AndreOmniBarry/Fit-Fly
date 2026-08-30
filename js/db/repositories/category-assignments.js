import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

/** Records one run of the category engine. `reasoning` is the plain-
 *  language "why this" explanation shown to the person; `inputsSnapshot`
 *  is the profile fields the decision was based on, kept so a later
 *  re-assignment can explain *what changed*. */
export async function recordCategoryAssignment(
  { category, reasoning, inputsSnapshot },
  db = getDb()
) {
  const entry = { category, reasoning, inputsSnapshot, assignedAt: nowIso() };
  const id = await db.categoryAssignments.add(entry);
  return { ...entry, id };
}

export async function getLatestCategoryAssignment(db = getDb()) {
  return db.categoryAssignments.orderBy('assignedAt').last();
}

export async function listCategoryAssignments(db = getDb()) {
  return db.categoryAssignments.orderBy('assignedAt').toArray();
}
