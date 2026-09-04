import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

/** IndexedDB indexes can't hold booleans, so program lifecycle is a string
 *  enum instead of an `active: true/false` flag. */
export const PROGRAM_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export async function createProgram(program, db = getDb()) {
  const record = {
    status: PROGRAM_STATUS.DRAFT,
    ...program,
    id: program.id ?? generateId(),
    createdAt: nowIso(),
  };
  await db.programs.put(record);
  return record;
}

export async function getProgram(id, db = getDb()) {
  return db.programs.get(id);
}

export async function setProgramStatus(id, status, db = getDb()) {
  await db.programs.update(id, { status });
}

/** Only one program should be ACTIVE per (category, trainingFocus) pair at
 *  a time — callers that activate a new program are expected to archive
 *  the old one first. `trainingFocus` isn't an indexed field (only
 *  hypertrophy's own two focuses ever need it — see
 *  category-engine.js), so it's filtered in JS rather than in the
 *  `where()` clause; `undefined` matches any program regardless of its
 *  own trainingFocus, `null` matches only programs with no focus set. */
export async function getActiveProgram(category, trainingFocus = undefined, db = getDb()) {
  const candidates = await db.programs.where({ category, status: PROGRAM_STATUS.ACTIVE }).toArray();
  if (trainingFocus === undefined) return candidates[0];
  return candidates.find((program) => (program.trainingFocus ?? null) === trainingFocus);
}

export async function listProgramsByCategory(category, db = getDb()) {
  return db.programs.where('category').equals(category).toArray();
}
