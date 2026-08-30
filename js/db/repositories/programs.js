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

/** Only one program should be ACTIVE per category at a time — callers that
 *  activate a new program are expected to archive the old one first. */
export async function getActiveProgram(category, db = getDb()) {
  return db.programs
    .where({ category, status: PROGRAM_STATUS.ACTIVE })
    .first();
}

export async function listProgramsByCategory(category, db = getDb()) {
  return db.programs.where('category').equals(category).toArray();
}
