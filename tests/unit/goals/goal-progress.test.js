import { describe, expect, it } from 'vitest';
import {
  calculateProgressPercent,
  daysUntilDeadline,
  isGoalAchieved,
} from '../../../js/features/goals/goal-progress.js';

describe('calculateProgressPercent', () => {
  it('is 0% at the start value and 100% at the target, for an increasing goal', () => {
    expect(calculateProgressPercent({ startValue: 2, currentValue: 2, targetValue: 5 })).toBe(0);
    expect(calculateProgressPercent({ startValue: 2, currentValue: 5, targetValue: 5 })).toBe(100);
  });

  it('is 50% halfway there', () => {
    expect(calculateProgressPercent({ startValue: 0, currentValue: 5, targetValue: 10 })).toBe(50);
  });

  it('works the same way for a decreasing goal (e.g. weight loss)', () => {
    expect(calculateProgressPercent({ startValue: 80, currentValue: 80, targetValue: 70 })).toBe(0);
    expect(calculateProgressPercent({ startValue: 80, currentValue: 75, targetValue: 70 })).toBe(50);
    expect(calculateProgressPercent({ startValue: 80, currentValue: 70, targetValue: 70 })).toBe(100);
  });

  it('clamps overshoot to 100%, never exceeding it', () => {
    expect(calculateProgressPercent({ startValue: 0, currentValue: 15, targetValue: 10 })).toBe(100);
  });

  it('clamps a regression below the start value to 0%, never negative', () => {
    expect(calculateProgressPercent({ startValue: 5, currentValue: 2, targetValue: 10 })).toBe(0);
  });

  it('handles a start value equal to the target without dividing by zero', () => {
    expect(calculateProgressPercent({ startValue: 5, currentValue: 5, targetValue: 5 })).toBe(100);
    expect(calculateProgressPercent({ startValue: 5, currentValue: 3, targetValue: 5 })).toBe(0);
  });
});

describe('isGoalAchieved', () => {
  it('an increase goal is achieved at or above target', () => {
    expect(isGoalAchieved({ direction: 'increase', currentValue: 10, targetValue: 10 })).toBe(true);
    expect(isGoalAchieved({ direction: 'increase', currentValue: 11, targetValue: 10 })).toBe(true);
    expect(isGoalAchieved({ direction: 'increase', currentValue: 9, targetValue: 10 })).toBe(false);
  });

  it('a decrease goal is achieved at or below target', () => {
    expect(isGoalAchieved({ direction: 'decrease', currentValue: 70, targetValue: 70 })).toBe(true);
    expect(isGoalAchieved({ direction: 'decrease', currentValue: 69, targetValue: 70 })).toBe(true);
    expect(isGoalAchieved({ direction: 'decrease', currentValue: 71, targetValue: 70 })).toBe(false);
  });
});

describe('daysUntilDeadline', () => {
  it('counts whole days from now to the deadline', () => {
    expect(daysUntilDeadline('2026-09-10', '2026-09-01')).toBe(9);
  });

  it('is negative for a deadline already past', () => {
    expect(daysUntilDeadline('2026-09-01', '2026-09-10')).toBe(-9);
  });

  it('is null with no deadline set', () => {
    expect(daysUntilDeadline(null)).toBeNull();
    expect(daysUntilDeadline(undefined)).toBeNull();
  });
});
