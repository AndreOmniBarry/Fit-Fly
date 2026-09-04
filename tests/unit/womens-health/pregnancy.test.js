import { describe, expect, it } from 'vitest';
import {
  dueDateFromLmp,
  lmpFromDueDate,
  gestationalAge,
  daysUntilDue,
  trimesterForWeek,
} from '../../../js/features/womens-health/pregnancy.js';

describe('dueDateFromLmp / lmpFromDueDate', () => {
  it('applies Naegele\'s rule: due date = LMP + 280 days', () => {
    expect(dueDateFromLmp('2026-01-01')).toBe('2026-10-08');
  });

  it('round-trips: lmpFromDueDate undoes dueDateFromLmp', () => {
    const lmp = '2026-03-15';
    expect(lmpFromDueDate(dueDateFromLmp(lmp))).toBe(lmp);
  });
});

describe('gestationalAge', () => {
  it('is 0 weeks/0 days exactly at the LMP date', () => {
    const dueDate = dueDateFromLmp('2026-01-01');
    expect(gestationalAge(dueDate, '2026-01-01')).toEqual({ weeks: 0, days: 0 });
  });

  it('is 40 weeks/0 days exactly on the due date', () => {
    const dueDate = dueDateFromLmp('2026-01-01');
    expect(gestationalAge(dueDate, dueDate)).toEqual({ weeks: 40, days: 0 });
  });

  it('computes a real week/day split partway through', () => {
    const dueDate = dueDateFromLmp('2026-01-01');
    // 2026-01-01 + 20 weeks + 3 days
    const onDate = '2026-05-24'; // 143 days after LMP = 20w3d
    expect(gestationalAge(dueDate, onDate)).toEqual({ weeks: 20, days: 3 });
  });

  it('never goes negative for a date before the LMP (a stale/incorrect due date)', () => {
    const dueDate = dueDateFromLmp('2026-06-01');
    expect(gestationalAge(dueDate, '2026-01-01')).toEqual({ weeks: 0, days: 0 });
  });

  it('clamps to a real ceiling well past full term, never an absurd age', () => {
    const dueDate = dueDateFromLmp('2020-01-01'); // years in the past
    const result = gestationalAge(dueDate, '2026-01-01');
    expect(result.weeks).toBeLessThanOrEqual(42);
  });
});

describe('daysUntilDue', () => {
  it('is positive before the due date', () => {
    expect(daysUntilDue('2026-10-08', '2026-10-01')).toBe(7);
  });

  it('is negative after the due date — an honest overdue signal, not hidden', () => {
    expect(daysUntilDue('2026-10-08', '2026-10-15')).toBe(-7);
  });

  it('is 0 exactly on the due date', () => {
    expect(daysUntilDue('2026-10-08', '2026-10-08')).toBe(0);
  });
});

describe('trimesterForWeek', () => {
  it.each([
    [1, 1],
    [13, 1],
    [14, 2],
    [27, 2],
    [28, 3],
    [40, 3],
  ])('week %i is trimester %i', (week, expected) => {
    expect(trimesterForWeek(week)).toBe(expected);
  });
});
