import { getDb } from '../client.js';
import { generateId, nowIso } from '../../lib/id.js';

export const GOAL_STATUS = Object.freeze({
  ACTIVE: 'active',
  ACHIEVED: 'achieved',
  ABANDONED: 'abandoned',
});

export async function createGoal(goal, db = getDb()) {
  const record = {
    status: GOAL_STATUS.ACTIVE,
    ...goal,
    id: goal.id ?? generateId(),
    createdAt: nowIso(),
  };
  await db.goals.put(record);
  return record;
}

export async function getGoal(id, db = getDb()) {
  return db.goals.get(id);
}

export async function updateGoal(id, patch, db = getDb()) {
  await db.goals.update(id, patch);
  return db.goals.get(id);
}

/** Logs a real progress update, keeping every prior one rather than just
 *  overwriting currentValue — the only way this app can show a real
 *  trend for a goal instead of one number that forgot everything before
 *  it. Embedded as an array on the goal's own record (same pattern as a
 *  run's route on its own record): only ever read back as a whole to
 *  draw this one goal's own history, never queried across goals. */
export async function logGoalProgress(id, value, db = getDb()) {
  const goal = await db.goals.get(id);
  const history = [...(goal?.history ?? []), { value, loggedAt: nowIso() }];
  await db.goals.update(id, { currentValue: value, history });
  return db.goals.get(id);
}

export async function listActiveGoals(db = getDb()) {
  return db.goals.where('status').equals(GOAL_STATUS.ACTIVE).sortBy('createdAt');
}

export async function listAllGoals(db = getDb()) {
  return db.goals.orderBy('createdAt').reverse().toArray();
}

export async function markGoalAchieved(id, db = getDb()) {
  await db.goals.update(id, { status: GOAL_STATUS.ACHIEVED, achievedAt: nowIso() });
  return db.goals.get(id);
}

export async function abandonGoal(id, db = getDb()) {
  await db.goals.update(id, { status: GOAL_STATUS.ABANDONED });
}
