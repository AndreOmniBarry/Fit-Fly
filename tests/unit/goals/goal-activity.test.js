import { describe, expect, it } from 'vitest';
import { inferActivityType } from '../../../js/features/goals/goal-activity.js';

describe('inferActivityType: reads the real name/unit a person already typed', () => {
  it('classifies a walking goal', () => {
    expect(inferActivityType({ name: 'Daily walk', unit: 'steps' })).toBe('walk');
    expect(inferActivityType({ name: 'Hit 10,000 steps', unit: '' })).toBe('walk');
  });

  it('classifies a running goal, distance unit included', () => {
    expect(inferActivityType({ name: 'Run a 5K', unit: 'km' })).toBe('run');
    expect(inferActivityType({ name: 'Marathon training', unit: 'mi' })).toBe('run');
  });

  it('prefers "walk" over a distance unit when the name says walk', () => {
    expect(inferActivityType({ name: 'Walk 5km every day', unit: 'km' })).toBe('walk');
  });

  it('classifies a hydration goal', () => {
    expect(inferActivityType({ name: 'Drink more water', unit: 'ml' })).toBe('hydration');
    expect(inferActivityType({ name: 'Daily hydration', unit: 'liters' })).toBe('hydration');
  });

  it('classifies a sleep goal', () => {
    expect(inferActivityType({ name: 'Get more sleep', unit: 'hours' })).toBe('sleep');
  });

  it('classifies a strength goal', () => {
    expect(inferActivityType({ name: 'Bench press PR', unit: 'kg' })).toBe('strength');
    expect(inferActivityType({ name: 'Squat progress', unit: 'lbs' })).toBe('strength');
  });

  it('classifies a bodyweight goal', () => {
    expect(inferActivityType({ name: 'Reach target weight', unit: 'kg' })).toBe('weight');
  });

  it('falls back to generic for an unrecognized goal — never guesses wrong', () => {
    expect(inferActivityType({ name: 'Save $1000', unit: '%' })).toBe('generic');
    expect(inferActivityType({ name: 'Read more books', unit: 'books' })).toBe('generic');
  });

  it('handles a goal with no name or unit at all without throwing', () => {
    expect(inferActivityType({})).toBe('generic');
    expect(() => inferActivityType({})).not.toThrow();
  });
});

describe('inferActivityType: an explicit goalType (goal-types.js\'s picker) always wins over guessing', () => {
  it('maps each real explicit type to its own real activity type', () => {
    expect(inferActivityType({ name: 'Anything', unit: 'kg', goalType: 'cardio' })).toBe('cardio');
    expect(inferActivityType({ name: 'Anything', unit: 'kg', goalType: 'strength' })).toBe('strength');
    expect(inferActivityType({ name: 'Anything', unit: 'kg', goalType: 'skill' })).toBe('skill');
    expect(inferActivityType({ name: 'Anything', unit: 'kg', goalType: 'body' })).toBe('weight');
  });

  it('overrides what the name/unit alone would have guessed', () => {
    // "kg" alone would normally infer 'weight' — an explicit Strength
    // type (a real, common case: tracking a lift total in kg) must win.
    expect(inferActivityType({ name: 'Deadlift total', unit: 'kg', goalType: 'strength' })).toBe('strength');
  });

  it('"custom" has no real type of its own — falls through to the same regex inference as always', () => {
    expect(inferActivityType({ name: 'Run a 5K', unit: 'km', goalType: 'custom' })).toBe('run');
    expect(inferActivityType({ name: 'Save $1000', unit: '%', goalType: 'custom' })).toBe('generic');
  });

  it('an unrecognized goalType is ignored, not a crash', () => {
    expect(inferActivityType({ name: 'Daily walk', unit: 'steps', goalType: 'not-a-real-type' })).toBe('walk');
  });
});
