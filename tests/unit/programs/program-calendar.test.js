import { describe, expect, it } from 'vitest';
import {
  classifyProgramCalendarDay,
  currentWeekRange,
  localDateFromIso,
  sessionDatesForProgram,
  weeklySessionProgress,
} from '../../../js/features/programs/program-calendar.js';

describe('localDateFromIso', () => {
  it('extracts the local calendar date, not a UTC slice', () => {
    // A local-midnight timestamp — .slice(0, 10) on the raw ISO string
    // would silently roll back a day for any timezone behind UTC, which
    // is exactly the bug this local getFullYear/Month/Date approach
    // avoids (same rule active-energy.js's isSameLocalDay already
    // established).
    expect(localDateFromIso('2026-03-15T00:00:00')).toBe('2026-03-15');
  });

  it('pads single-digit months and days', () => {
    expect(localDateFromIso('2026-01-05T10:00:00')).toBe('2026-01-05');
  });
});

describe('sessionDatesForProgram', () => {
  it('returns a set of the distinct real days sessions were logged on', () => {
    const dates = sessionDatesForProgram([
      { startedAt: '2026-03-15T09:00:00' },
      { startedAt: '2026-03-15T18:00:00' }, // same day, different session — still one date
      { startedAt: '2026-03-17T09:00:00' },
    ]);
    expect(dates).toEqual(new Set(['2026-03-15', '2026-03-17']));
  });

  it('is empty for no sessions — never a fabricated placeholder day', () => {
    expect(sessionDatesForProgram([])).toEqual(new Set());
  });
});

describe('currentWeekRange', () => {
  it('starts on Sunday and ends on Saturday, same convention as the month-grid math', () => {
    // 2026-03-18 is a Wednesday.
    expect(currentWeekRange('2026-03-18')).toEqual({ start: '2026-03-15', end: '2026-03-21' });
  });

  it('handles today itself being a Sunday', () => {
    expect(currentWeekRange('2026-03-15')).toEqual({ start: '2026-03-15', end: '2026-03-21' });
  });

  it('spans a month boundary correctly', () => {
    // 2026-04-01 is a Wednesday; the week runs from the last days of March.
    expect(currentWeekRange('2026-04-01')).toEqual({ start: '2026-03-29', end: '2026-04-04' });
  });
});

describe('weeklySessionProgress', () => {
  it('counts only this week\'s sessions against the program\'s own weekly day count', () => {
    const dates = new Set(['2026-03-15', '2026-03-17', '2026-02-01']); // one date outside this week
    const progress = weeklySessionProgress(dates, '2026-03-18', 3);
    expect(progress).toEqual({ completed: 2, planned: 3, percent: 67 });
  });

  it('never fabricates over 100%, but keeps the real completed count when training beyond the plan', () => {
    const dates = new Set(['2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18']);
    const progress = weeklySessionProgress(dates, '2026-03-18', 3);
    expect(progress).toEqual({ completed: 4, planned: 3, percent: 100 });
  });

  it('is honestly zero, not NaN, when nothing has been logged this week', () => {
    expect(weeklySessionProgress(new Set(), '2026-03-18', 3)).toEqual({ completed: 0, planned: 3, percent: 0 });
  });

  it('never divides by zero if a program somehow has no training days this week', () => {
    expect(weeklySessionProgress(new Set(), '2026-03-18', 0)).toEqual({ completed: 0, planned: 0, percent: 0 });
  });
});

describe('classifyProgramCalendarDay', () => {
  const base = { date: '2026-03-15', programStartDate: '2026-03-01' };

  it('a day with a logged session is "logged", regardless of anything else', () => {
    expect(classifyProgramCalendarDay({ ...base, hasSession: true, isFuture: false })).toBe('logged');
    expect(classifyProgramCalendarDay({ ...base, hasSession: true, isFuture: true })).toBe('logged');
  });

  it('a future day with nothing logged is "future" — nothing to claim about it yet', () => {
    expect(classifyProgramCalendarDay({ ...base, hasSession: false, isFuture: true })).toBe('future');
  });

  it('a real past/today day within the program\'s own window with nothing logged is a real "rest" day', () => {
    expect(classifyProgramCalendarDay({ ...base, hasSession: false, isFuture: false })).toBe('rest');
  });

  it('a day before the program even started is "before-program", never a missed/rest day', () => {
    expect(
      classifyProgramCalendarDay({ date: '2026-02-20', programStartDate: '2026-03-01', hasSession: false, isFuture: false })
    ).toBe('before-program');
  });

  it('with no known program start date, any non-future empty day is honestly a rest day', () => {
    expect(
      classifyProgramCalendarDay({ date: '2026-01-01', programStartDate: null, hasSession: false, isFuture: false })
    ).toBe('rest');
  });
});
