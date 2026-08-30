import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  addNutritionEntry,
  deleteNutritionEntry,
  listNutritionEntriesForDate,
  sumNutritionEntries,
} from '../../../js/db/repositories/nutrition.js';

describe('nutrition repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`nutrition-test-${Math.random()}`);
  });

  it('adds an entry with a generated id and timestamp', async () => {
    const entry = await addNutritionEntry(
      { date: '2026-08-01', name: 'Oatmeal', calories: 300, proteinG: 10, carbsG: 50, fatG: 6 },
      db
    );
    expect(entry.id).toBeTruthy();
    expect(entry.loggedAt).toBeTruthy();
  });

  it('lists entries for one date only, ordered by time logged', async () => {
    await addNutritionEntry({ date: '2026-08-01', name: 'A', calories: 100 }, db);
    await addNutritionEntry({ date: '2026-08-02', name: 'B', calories: 200 }, db);
    await addNutritionEntry({ date: '2026-08-01', name: 'C', calories: 150 }, db);

    const day1 = await listNutritionEntriesForDate('2026-08-01', db);
    expect(day1.map((e) => e.name)).toEqual(['A', 'C']);
  });

  it('deletes a single entry', async () => {
    const entry = await addNutritionEntry({ date: '2026-08-01', name: 'A', calories: 100 }, db);
    await deleteNutritionEntry(entry.id, db);
    expect(await listNutritionEntriesForDate('2026-08-01', db)).toEqual([]);
  });
});

describe('sumNutritionEntries', () => {
  it('sums calories and every macro across entries', () => {
    const entries = [
      { calories: 300, proteinG: 10, carbsG: 50, fatG: 6 },
      { calories: 200, proteinG: 20, carbsG: 10, fatG: 4 },
    ];
    expect(sumNutritionEntries(entries)).toEqual({ calories: 500, proteinG: 30, carbsG: 60, fatG: 10 });
  });

  it('treats a missing macro field as 0 rather than producing NaN', () => {
    const entries = [{ calories: 100 }];
    expect(sumNutritionEntries(entries)).toEqual({ calories: 100, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('sums to all zeros for an empty day, not null/undefined', () => {
    expect(sumNutritionEntries([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});
