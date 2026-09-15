import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';

/** Records one completed chronotype self-assessment (see
 *  js/features/chronotype/chronotype.ts). Stores the real per-question
 *  answers alongside the computed total/category so a past assessment's
 *  own inputs stay inspectable, not just its output — same shape as
 *  recordVo2maxTest. */
export async function recordChronotypeAssessment({ answers, total, category }, db = getDb()) {
  const entry = { answers, total, category, takenAt: nowIso() };
  const id = await db.chronotypeAssessments.add(entry);
  return { ...entry, id };
}

export async function listRecentChronotypeAssessments(limit = 20, db = getDb()) {
  return db.chronotypeAssessments.orderBy('takenAt').reverse().limit(limit).toArray();
}
