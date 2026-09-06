import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY,
  EQUIPMENT,
  EXERCISE_LIBRARY,
  getLibraryExercise,
  LOG_METRIC,
  MOVEMENT_PATTERNS,
} from '../../../js/features/exercises/exercise-library.js';
import { BODY_AREA_TAGS } from '../../../js/features/programs/body-area-tag.js';
import { categorizeExercise, MOVEMENT_CATEGORIES } from '../../../js/features/exercises/movement-category.js';

describe('EXERCISE_LIBRARY data integrity', () => {
  it('has unique ids', () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry uses a recognized pattern/equipment/difficulty and a non-empty name/cues', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      expect(MOVEMENT_PATTERNS).toContain(exercise.pattern);
      expect(EQUIPMENT).toContain(exercise.equipment);
      expect(DIFFICULTY).toContain(exercise.difficulty);
      expect(exercise.name.length).toBeGreaterThan(0);
      expect(exercise.cues.length).toBeGreaterThan(0);
      expect(Array.isArray(exercise.muscleGroups)).toBe(true);
      expect(exercise.muscleGroups.length).toBeGreaterThan(0);
    }
  });

  it("no bodyweight exercise is logged as reps-weight — there's no real 'kg' for your own bodyweight", () => {
    for (const exercise of EXERCISE_LIBRARY) {
      expect(LOG_METRIC).toContain(exercise.logMetric);
      if (exercise.equipment === 'bodyweight') {
        expect(exercise.logMetric).not.toBe('reps-weight');
      }
    }
  });

  it('every dumbbell exercise is logged as reps-weight — it genuinely has a real, loggable weight', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      if (exercise.equipment === 'dumbbell') {
        expect(exercise.logMetric).toBe('reps-weight');
      }
    }
  });

  it('every contraindication tag is a recognized body-area tag', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      for (const tag of exercise.contraindications) {
        expect(BODY_AREA_TAGS).toContain(tag);
      }
    }
  });

  it('every entry resolves to a real, recognized movement-demo category — no exercise left un-animatable', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      expect(MOVEMENT_CATEGORIES).toContain(categorizeExercise(exercise));
    }
  });

  it('every movement pattern has at least one beginner-difficulty exercise', () => {
    // otherwise a beginner's program could silently skip a whole day slot
    for (const pattern of MOVEMENT_PATTERNS) {
      const hasBeginnerOption = EXERCISE_LIBRARY.some(
        (e) => e.pattern === pattern && e.difficulty === 'beginner'
      );
      expect(hasBeginnerOption).toBe(true);
    }
  });

  it('only a real cardio exercise can be marked distance-trackable', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      if (exercise.distanceTrackable) expect(exercise.logMetric).toBe('cardio');
    }
  });

  it('getLibraryExercise finds a real entry and returns undefined for an unknown id', () => {
    expect(getLibraryExercise('push-up')?.name).toBe('Push-Up');
    expect(getLibraryExercise('not-a-real-id')).toBeUndefined();
  });
});
