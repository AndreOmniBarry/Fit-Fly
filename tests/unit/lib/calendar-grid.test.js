import { describe, expect, it } from 'vitest';
import { formatMonthLabel, getMonthGridDays, monthDateRange } from '../../../js/lib/calendar-grid.js';

describe('getMonthGridDays', () => {
  it('every row is a full week — total cells is a multiple of 7', () => {
    // September 2026 starts on a Tuesday, 30 days — a good non-trivial case.
    const days = getMonthGridDays(2026, 8, '2026-09-01');
    expect(days.length % 7).toBe(0);
  });

  it('includes every real day of the month, each exactly once, marked inMonth', () => {
    const days = getMonthGridDays(2026, 8, '2026-09-01');
    const inMonthDates = days.filter((d) => d.inMonth).map((d) => d.date);
    expect(inMonthDates).toHaveLength(30);
    expect(new Set(inMonthDates).size).toBe(30);
    expect(inMonthDates[0]).toBe('2026-09-01');
    expect(inMonthDates[29]).toBe('2026-09-30');
  });

  it('leading/trailing blanks belong to the neighboring month, marked !inMonth', () => {
    const days = getMonthGridDays(2026, 8, '2026-09-01'); // Sep 1 2026 is a Tuesday
    const leading = days.slice(0, 2); // Sun, Mon before Sep 1
    for (const day of leading) {
      expect(day.inMonth).toBe(false);
      expect(day.date < '2026-09-01').toBe(true);
    }
  });

  it('marks exactly the injected today, and every date after it as future', () => {
    const days = getMonthGridDays(2026, 8, '2026-09-15');
    const today = days.filter((d) => d.isToday);
    expect(today).toHaveLength(1);
    expect(today[0]?.date).toBe('2026-09-15');

    const future = days.filter((d) => d.isFuture).map((d) => d.date);
    expect(future.every((d) => d > '2026-09-15')).toBe(true);
    expect(future).toContain('2026-09-16');
    expect(future).not.toContain('2026-09-15');
    expect(future).not.toContain('2026-09-14');
  });

  it('a month viewed from the past has no future days at all', () => {
    const days = getMonthGridDays(2026, 0, '2026-09-15'); // January, viewed in September
    expect(days.some((d) => d.isFuture)).toBe(false);
  });
});

describe('formatMonthLabel', () => {
  it('formats a full month name and year', () => {
    expect(formatMonthLabel(2026, 0)).toBe('January 2026');
    expect(formatMonthLabel(2026, 11)).toBe('December 2026');
  });
});

describe('monthDateRange', () => {
  it('returns the first and last calendar date of the month', () => {
    expect(monthDateRange(2026, 8)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthDateRange(2024, 1)).toEqual({ start: '2024-02-01', end: '2024-02-29' }); // leap year
  });
});
