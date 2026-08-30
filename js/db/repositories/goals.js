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
