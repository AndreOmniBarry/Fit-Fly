import { bulkUpsertExercises } from '../../db/repositories/exercises.js';
import { EXERCISE_LIBRARY } from './exercise-library.js';

/** Idempotent — bulkPut overwrites by id, so calling this on every app
 *  boot just keeps the stored library in sync with the built-in one. */
export async function seedExerciseLibrary() {
  await bulkUpsertExercises(EXERCISE_LIBRARY);
}
