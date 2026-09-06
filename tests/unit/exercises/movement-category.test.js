import { describe, expect, it } from 'vitest';
import { categorizeExercise, MOVEMENT_CATEGORIES } from '../../../js/features/exercises/movement-category.js';
import { EXERCISE_LIBRARY, getLibraryExercise } from '../../../js/features/exercises/exercise-library.js';

describe('categorizeExercise', () => {
  it('maps a strength pattern onto itself', () => {
    expect(categorizeExercise({ pattern: 'squat', logMetric: 'reps' })).toBe('squat');
    expect(categorizeExercise({ pattern: 'hinge', logMetric: 'reps-weight' })).toBe('hinge');
    expect(categorizeExercise({ pattern: 'push', logMetric: 'reps' })).toBe('push');
    expect(categorizeExercise({ pattern: 'pull', logMetric: 'reps-weight' })).toBe('pull');
  });

  it('splits the "core" pattern by logMetric — a hold and a dynamic drill are not the same movement', () => {
    expect(categorizeExercise({ pattern: 'core', logMetric: 'hold' })).toBe('hold');
    expect(categorizeExercise({ pattern: 'core', logMetric: 'reps' })).toBe('core');
  });

  it('maps cardio and mobility patterns onto themselves regardless of logMetric', () => {
    expect(categorizeExercise({ pattern: 'cardio', logMetric: 'cardio' })).toBe('cardio');
    expect(categorizeExercise({ pattern: 'mobility', logMetric: 'hold' })).toBe('mobility');
    expect(categorizeExercise({ pattern: 'mobility', logMetric: 'reps' })).toBe('mobility');
  });

  it('every real library exercise resolves to a recognized category', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      expect(MOVEMENT_CATEGORIES).toContain(categorizeExercise(exercise));
    }
  });

  it('known exercises land on the category their real movement actually is', () => {
    expect(categorizeExercise(getLibraryExercise('bodyweight-squat'))).toBe('squat');
    expect(categorizeExercise(getLibraryExercise('romanian-deadlift'))).toBe('hinge');
    expect(categorizeExercise(getLibraryExercise('push-up'))).toBe('push');
    expect(categorizeExercise(getLibraryExercise('bent-over-row'))).toBe('pull');
    expect(categorizeExercise(getLibraryExercise('plank'))).toBe('hold');
    expect(categorizeExercise(getLibraryExercise('dead-bug'))).toBe('core');
    expect(categorizeExercise(getLibraryExercise('standing-march'))).toBe('cardio');
    expect(categorizeExercise(getLibraryExercise('brisk-walk-jog'))).toBe('cardio');
    expect(categorizeExercise(getLibraryExercise('cat-cow-stretch'))).toBe('mobility');
    expect(categorizeExercise(getLibraryExercise('hip-flexor-stretch'))).toBe('mobility');
  });
});
