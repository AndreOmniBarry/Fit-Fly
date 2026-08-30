import { describe, expect, it } from 'vitest';
import { getCurrentWeekNumber } from '../../../js/features/programs/week-number.js';

describe('getCurrentWeekNumber', () => {
  it('is week 1 on the start date itself', () => {
    expect(getCurrentWeekNumber('2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')).toBe(1);
  });

  it('stays week 1 through day 6', () => {
    expect(getCurrentWeekNumber('2026-08-01T00:00:00.000Z', '2026-08-07T23:59:59.000Z')).toBe(1);
  });

  it('rolls to week 2 exactly at day 7', () => {
    expect(getCurrentWeekNumber('2026-08-01T00:00:00.000Z', '2026-08-08T00:00:00.000Z')).toBe(2);
  });

  it('rolls to week 5 after four full weeks', () => {
    expect(getCurrentWeekNumber('2026-08-01T00:00:00.000Z', '2026-08-29T00:00:00.000Z')).toBe(5);
  });

  it('clamps to week 1 if "now" is somehow before the start date', () => {
    expect(getCurrentWeekNumber('2026-08-10T00:00:00.000Z', '2026-08-01T00:00:00.000Z')).toBe(1);
  });
});
