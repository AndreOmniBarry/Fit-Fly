import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import {
  bulkUpsertExercises,
  getExercise,
  listAllExercises,
  listExercisesByEquipment,
  listExercisesByMuscleGroup,
  upsertExercise,
} from '../../../js/db/repositories/exercises.js';

const GOBLET_SQUAT = {
  id: 'goblet-squat',
  name: 'Goblet Squat',
  muscleGroups: ['quads', 'glutes'],
  equipment: 'dumbbell',
  difficulty: 'beginner',
};

const PUSH_UP = {
  id: 'push-up',
  name: 'Push-Up',
  muscleGroups: ['chest', 'triceps'],
  equipment: 'bodyweight',
  difficulty: 'beginner',
};

describe('exercises repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`exercises-test-${Math.random()}`);
  });

  it('round-trips a single exercise', async () => {
    await upsertExercise(GOBLET_SQUAT, db);
    expect(await getExercise('goblet-squat', db)).toEqual(GOBLET_SQUAT);
  });

  it('bulk-seeds the library and lists it all back', async () => {
    await bulkUpsertExercises([GOBLET_SQUAT, PUSH_UP], db);
    const all = await listAllExercises(db);
    expect(all).toHaveLength(2);
  });

  it('a multi-entry muscleGroups index finds an exercise by any of its groups', async () => {
    await bulkUpsertExercises([GOBLET_SQUAT, PUSH_UP], db);

    expect((await listExercisesByMuscleGroup('quads', db)).map((e) => e.id)).toEqual(['goblet-squat']);
    expect((await listExercisesByMuscleGroup('chest', db)).map((e) => e.id)).toEqual(['push-up']);
    expect(await listExercisesByMuscleGroup('calves', db)).toEqual([]);
  });

  it('filters by equipment', async () => {
    await bulkUpsertExercises([GOBLET_SQUAT, PUSH_UP], db);
    expect((await listExercisesByEquipment('bodyweight', db)).map((e) => e.id)).toEqual(['push-up']);
  });
});
