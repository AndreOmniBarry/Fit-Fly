import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  getLatestCategoryAssignment,
  listCategoryAssignments,
  recordCategoryAssignment,
} from '../../../js/db/repositories/category-assignments.js';

describe('category-assignments repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`category-test-${Math.random()}`);
  });

  it('has no assignments before onboarding runs', async () => {
    expect(await getLatestCategoryAssignment(db)).toBeUndefined();
    expect(await listCategoryAssignments(db)).toEqual([]);
  });

  it('keeps every assignment as an append-only history', async () => {
    await recordCategoryAssignment(
      { category: 'sedentary-start', reasoning: 'first onboarding', inputsSnapshot: {} },
      db
    );
    await recordCategoryAssignment(
      { category: 'hypertrophy', reasoning: 'six months of consistent training', inputsSnapshot: {} },
      db
    );

    const all = await listCategoryAssignments(db);
    expect(all).toHaveLength(2);
    expect(all[0].category).toBe('sedentary-start');
    expect(all[1].category).toBe('hypertrophy');
  });

  it('getLatestCategoryAssignment returns the most recent one', async () => {
    await recordCategoryAssignment({ category: 'sedentary-start', reasoning: '', inputsSnapshot: {} }, db);
    await recordCategoryAssignment({ category: 'endurance', reasoning: '', inputsSnapshot: {} }, db);

    const latest = await getLatestCategoryAssignment(db);
    expect(latest.category).toBe('endurance');
  });
});
