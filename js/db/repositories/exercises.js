import { getDb } from '../client.js';

export async function upsertExercise(exercise, db = getDb()) {
  await db.exercises.put(exercise);
  return exercise;
}

export async function bulkUpsertExercises(exercises, db = getDb()) {
  await db.exercises.bulkPut(exercises);
}

export async function getExercise(id, db = getDb()) {
  return db.exercises.get(id);
}

export async function listAllExercises(db = getDb()) {
  return db.exercises.toArray();
}

export async function listExercisesByMuscleGroup(muscleGroup, db = getDb()) {
  return db.exercises.where('muscleGroups').equals(muscleGroup).toArray();
}

export async function listExercisesByEquipment(equipment, db = getDb()) {
  return db.exercises.where('equipment').equals(equipment).toArray();
}
