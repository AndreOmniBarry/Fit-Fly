import { describe, expect, it } from 'vitest';
import { generateProgram } from '../../../js/features/programs/program-generator.js';
import { getLibraryExercise } from '../../../js/features/exercises/exercise-library.js';

describe('generateProgram: basic shape', () => {
  it('produces the right number of days for each category', () => {
    expect(generateProgram({ category: 'sedentary-start', experienceLevel: 'beginner' }).days).toHaveLength(2);
    expect(generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner' }).days).toHaveLength(3);
    expect(generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced' }).days).toHaveLength(4);
  });

  it('every day has at least one exercise for a healthy, experienced person', () => {
    const program = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced' });
    for (const day of program.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
    }
  });

  it('every day includes a warm-up and cooldown — never just the working sets', () => {
    const program = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner' });
    for (const day of program.days) {
      expect(day.warmup.length).toBeGreaterThan(0);
      expect(day.cooldown.length).toBeGreaterThan(0);
    }
  });

  it('throws on an unknown category', () => {
    expect(() => generateProgram({ category: 'shred-mode', experienceLevel: 'beginner' })).toThrow();
  });

  it('is deterministic: identical inputs produce an identical program', () => {
    const input = { category: 'recomposition', experienceLevel: 'intermediate', weekNumber: 2 };
    expect(generateProgram(input)).toEqual(generateProgram(input));
  });
});

describe('generateProgram: difficulty gating', () => {
  it('a beginner never gets an intermediate or advanced exercise', () => {
    const program = generateProgram({ category: 'hypertrophy', experienceLevel: 'beginner' });
    for (const day of program.days) {
      for (const { exerciseId } of day.exercises) {
        expect(getLibraryExercise(exerciseId).difficulty).toBe('beginner');
      }
    }
  });

  it('an advanced person can get beginner, intermediate, or advanced exercises', () => {
    const program = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced' });
    const difficulties = program.days.flatMap((d) => d.exercises.map((e) => getLibraryExercise(e.exerciseId).difficulty));
    expect(difficulties.length).toBeGreaterThan(0);
    for (const difficulty of difficulties) {
      expect(['beginner', 'intermediate', 'advanced']).toContain(difficulty);
    }
  });
});

describe('generateProgram: injury safety routing', () => {
  it('excludes any exercise whose contraindications match a flagged body area', () => {
    const program = generateProgram({
      category: 'hypertrophy',
      experienceLevel: 'advanced',
      injuryBodyAreaTags: ['shoulder'],
    });
    const pickedIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    for (const id of pickedIds) {
      expect(getLibraryExercise(id).contraindications).not.toContain('shoulder');
    }
  });

  it('notes the exclusion in the reasoning', () => {
    const program = generateProgram({
      category: 'hypertrophy',
      experienceLevel: 'advanced',
      injuryBodyAreaTags: ['knee'],
    });
    expect(program.reasoning.some((line) => line.includes('knee'))).toBe(true);
  });

  it('a gentle, no-contraindication exercise (e.g. dead bug) always survives every filter', () => {
    const program = generateProgram({
      category: 'rehab-recuperation',
      experienceLevel: 'beginner',
      injuryBodyAreaTags: ['knee', 'hip', 'shoulder', 'lower-back', 'wrist', 'ankle', 'neck'],
    });
    const pickedIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(pickedIds).toContain('dead-bug');
  });
});

describe('generateProgram: periodization', () => {
  it('week 4 (the deload) has fewer sets than week 1, same category/experience', () => {
    const week1 = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', weekNumber: 1 });
    const week4 = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', weekNumber: 4 });

    expect(week1.isDeload).toBe(false);
    expect(week4.isDeload).toBe(true);
    expect(week4.days[0].exercises[0].sets).toBeLessThan(week1.days[0].exercises[0].sets);
  });

  it('notes the deload in the reasoning only on a deload week', () => {
    const week1 = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', weekNumber: 1 });
    const week4 = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', weekNumber: 4 });
    expect(week1.reasoning.some((l) => l.toLowerCase().includes('deload'))).toBe(false);
    expect(week4.reasoning.some((l) => l.toLowerCase().includes('deload'))).toBe(true);
  });

  it('sets never drop to zero even on a deload with a low base', () => {
    const week4 = generateProgram({ category: 'endurance', experienceLevel: 'advanced', weekNumber: 4 });
    for (const day of week4.days) {
      for (const exercise of day.exercises) {
        expect(exercise.sets).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('generateProgram: reasoning is always present', () => {
  it('every category has at least one reasoning line', () => {
    const categories = [
      'sedentary-start',
      'cut-fat-loss',
      'recomposition',
      'rehab-recuperation',
      'hypertrophy',
      'endurance',
    ];
    for (const category of categories) {
      const program = generateProgram({ category, experienceLevel: 'intermediate' });
      expect(program.reasoning.length).toBeGreaterThan(0);
      expect(program.reasoning[0].length).toBeGreaterThan(10);
    }
  });
});
