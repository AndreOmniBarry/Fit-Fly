import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  abandonGoal,
  createGoal,
  getGoal,
  GOAL_STATUS,
  listActiveGoals,
  listAllGoals,
  markGoalAchieved,
  updateGoal,
} from '../../../js/db/repositories/goals.js';

describe('goals repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`goals-test-${Math.random()}`);
  });

  it('creates a goal defaulting to active status with a generated id', async () => {
    const goal = await createGoal({ name: 'Run a 5K', unit: 'km', direction: 'increase', startValue: 0, targetValue: 5, currentValue: 0 }, db);
    expect(goal.status).toBe(GOAL_STATUS.ACTIVE);
    expect(goal.id).toBeTruthy();
    expect(await getGoal(goal.id, db)).toEqual(goal);
  });

  it('updateGoal patches fields, e.g. currentValue as progress is made', async () => {
    const goal = await createGoal({ name: 'Run a 5K', currentValue: 0, targetValue: 5, startValue: 0, direction: 'increase' }, db);
    const updated = await updateGoal(goal.id, { currentValue: 3 }, db);
    expect(updated.currentValue).toBe(3);
    expect(updated.name).toBe('Run a 5K'); // untouched field survives
  });

  it('markGoalAchieved sets status and stamps achievedAt', async () => {
    const goal = await createGoal({ name: 'x', currentValue: 5, targetValue: 5, startValue: 0, direction: 'increase' }, db);
    const achieved = await markGoalAchieved(goal.id, db);
    expect(achieved.status).toBe(GOAL_STATUS.ACHIEVED);
    expect(achieved.achievedAt).toBeTruthy();
  });

  it('abandonGoal sets status without touching achievedAt', async () => {
    const goal = await createGoal({ name: 'x' }, db);
    await abandonGoal(goal.id, db);
    expect((await getGoal(goal.id, db)).status).toBe(GOAL_STATUS.ABANDONED);
  });

  it('listActiveGoals excludes achieved/abandoned goals', async () => {
    const active = await createGoal({ name: 'active' }, db);
    const achieved = await createGoal({ name: 'achieved' }, db);
    await markGoalAchieved(achieved.id, db);

    const activeGoals = await listActiveGoals(db);
    expect(activeGoals.map((g) => g.id)).toEqual([active.id]);
  });

  it('listAllGoals returns every goal regardless of status, newest first', async () => {
    await createGoal({ name: 'a' }, db);
    await createGoal({ name: 'b' }, db);
    expect(await listAllGoals(db)).toHaveLength(2);
  });
});
