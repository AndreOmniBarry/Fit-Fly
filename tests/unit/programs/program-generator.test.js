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

  it('exercise selection rotates into block 2 where a safe alternative exists, still deterministically', () => {
    // rehab-recuperation's mobility days always include a 'core' slot —
    // plank and dead-bug are both real, beginner-eligible candidates for
    // it, so this is a genuine choice, not a forced single option.
    const block1 = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner', weekNumber: 1 });
    const block2 = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner', weekNumber: 5 }); // week 5 = block 2

    const coreExerciseInBlock1 = block1.days[0].exercises.find((e) => ['plank', 'dead-bug'].includes(e.exerciseId));
    const coreExerciseInBlock2 = block2.days[0].exercises.find((e) => ['plank', 'dead-bug'].includes(e.exerciseId));
    expect(coreExerciseInBlock1).toBeDefined();
    expect(coreExerciseInBlock2).toBeDefined();
    expect(coreExerciseInBlock1.exerciseId).not.toBe(coreExerciseInBlock2.exerciseId);

    // Still fully reproducible: re-running block 2 gives the exact same pick.
    const block2Again = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner', weekNumber: 5 });
    expect(block2Again).toEqual(block2);
  });

  it('notes the rotation in the reasoning starting block 2, not block 1', () => {
    const block1 = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner', weekNumber: 1 });
    const block2 = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner', weekNumber: 5 });
    expect(block1.reasoning.some((l) => l.toLowerCase().includes('rotated'))).toBe(false);
    expect(block2.reasoning.some((l) => l.toLowerCase().includes('rotated'))).toBe(true);
  });
});

describe('generateProgram: trainingFocus (hypertrophy vs strength)', () => {
  it('trainingFocus "strength" on category hypertrophy uses a real, distinct strength prescription', () => {
    const hypertrophyProgram = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', trainingFocus: 'hypertrophy' });
    const strengthProgram = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', trainingFocus: 'strength' });

    const hyperExercise = hypertrophyProgram.days[0].exercises[0];
    const strengthExercise = strengthProgram.days[0].exercises[0];
    expect(strengthExercise.reps).not.toBe(hyperExercise.reps);
    expect(strengthExercise.restSec).toBeGreaterThan(hyperExercise.restSec);
    expect(strengthExercise.sets).toBeGreaterThan(hyperExercise.sets);
    expect(strengthProgram.reasoning[0]).not.toBe(hypertrophyProgram.reasoning[0]);
  });

  it('trainingFocus only changes the prescription for category hypertrophy — a non-hypertrophy category ignores it', () => {
    const withoutFocus = generateProgram({ category: 'endurance', experienceLevel: 'advanced' });
    const withStrayFocus = generateProgram({ category: 'endurance', experienceLevel: 'advanced', trainingFocus: 'strength' });
    expect(withStrayFocus).toEqual(withoutFocus);
  });

  it('trainingFocus is carried through onto the returned program', () => {
    const program = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced', trainingFocus: 'strength' });
    expect(program.trainingFocus).toBe('strength');
  });
});

describe('generateProgram: per-exercise logMetric', () => {
  it('every generated exercise carries the same logMetric as its library entry', () => {
    const program = generateProgram({ category: 'hypertrophy', experienceLevel: 'advanced' });
    for (const day of program.days) {
      for (const exercise of day.exercises) {
        expect(exercise.logMetric).toBe(getLibraryExercise(exercise.exerciseId).logMetric);
      }
    }
  });

  it('a timed exercise (plank) is prescribed a real holdSec range, not a rep count relabeled', () => {
    // rehab-recuperation's mobility days include core work — plank is a
    // real, beginner-eligible, no-contraindication candidate for it.
    const program = generateProgram({ category: 'rehab-recuperation', experienceLevel: 'beginner' });
    const plank = program.days.flatMap((d) => d.exercises).find((e) => e.exerciseId === 'plank');
    expect(plank).toBeDefined();
    expect(plank.logMetric).toBe('time');
    expect(plank.holdSec).toMatch(/^\d+-\d+$/);
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
