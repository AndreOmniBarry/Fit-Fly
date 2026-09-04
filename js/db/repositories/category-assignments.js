import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

/** Records one run of the category engine. `reasoning` is the plain-
 *  language "why this" explanation shown to the person; `inputsSnapshot`
 *  is the profile fields the decision was based on, kept so a later
 *  re-assignment can explain *what changed*. `trainingFocus` (only
 *  meaningful for category 'hypertrophy' — see category-engine.js) is
 *  stored as its own top-level field, not just inside inputsSnapshot, so
 *  Programs can read it without re-deriving it from a stored primaryGoal
 *  every time. */
export async function recordCategoryAssignment(
  { category, reasoning, inputsSnapshot, trainingFocus = null },
  db = getDb()
) {
  const entry = { category, reasoning, inputsSnapshot, trainingFocus, assignedAt: nowIso() };
  const id = await db.categoryAssignments.add(entry);
  return { ...entry, id };
}

export async function getLatestCategoryAssignment(db = getDb()) {
  return db.categoryAssignments.orderBy('assignedAt').last();
}

export async function listCategoryAssignments(db = getDb()) {
  return db.categoryAssignments.orderBy('assignedAt').toArray();
}
