import { describe, expect, it } from 'vitest';
import { averagePeriodLengthDays, derivePeriodStartDates } from '../../../js/features/womens-health/constants.js';

describe('derivePeriodStartDates', () => {
  it('a single bleeding streak counts as one start date, not every day of it', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'medium' },
      { date: '2026-08-02', flowIntensity: 'heavy' },
      { date: '2026-08-03', flowIntensity: 'light' },
      { date: '2026-08-04', flowIntensity: 'none' },
    ];
    expect(derivePeriodStartDates(days)).toEqual(['2026-08-01']);
  });

  it('two separate streaks (a real cycle gap between them) both count', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'medium' },
      { date: '2026-08-02', flowIntensity: 'light' },
      { date: '2026-08-15', flowIntensity: 'none' },
      { date: '2026-08-29', flowIntensity: 'medium' },
      { date: '2026-08-30', flowIntensity: 'light' },
    ];
    expect(derivePeriodStartDates(days)).toEqual(['2026-08-01', '2026-08-29']);
  });

  it('a non-consecutive-day gap between two flow days still counts as two starts', () => {
    // spotting on day 1, nothing logged, then real flow days later — not
    // one continuous streak just because both entries have flow.
    const days = [
      { date: '2026-08-01', flowIntensity: 'spotting' },
      { date: '2026-08-10', flowIntensity: 'medium' },
    ];
    expect(derivePeriodStartDates(days)).toEqual(['2026-08-01', '2026-08-10']);
  });

  it('days with no flow contribute no start dates', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'none' },
      { date: '2026-08-02', flowIntensity: 'none' },
    ];
    expect(derivePeriodStartDates(days)).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(derivePeriodStartDates([])).toEqual([]);
  });
});

describe('averagePeriodLengthDays', () => {
  it('is null with an empty list', () => {
    expect(averagePeriodLengthDays([])).toBeNull();
  });

  it('a single streak confirmed to have ended by a later no-flow day', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'medium' },
      { date: '2026-08-02', flowIntensity: 'heavy' },
      { date: '2026-08-03', flowIntensity: 'light' },
      { date: '2026-08-04', flowIntensity: 'none' },
    ];
    expect(averagePeriodLengthDays(days)).toBe(3);
  });

  it('is null for a single streak still running at the very end of the log — unconfirmed, not guessed', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'medium' },
      { date: '2026-08-02', flowIntensity: 'heavy' },
    ];
    expect(averagePeriodLengthDays(days)).toBeNull();
  });

  it('averages multiple confirmed streaks, excluding only the trailing unconfirmed one', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'medium' }, // 1-day streak, confirmed by 08-02
      { date: '2026-08-02', flowIntensity: 'none' },
      { date: '2026-08-10', flowIntensity: 'heavy' }, // 3-day streak, confirmed by 08-13
      { date: '2026-08-11', flowIntensity: 'medium' },
      { date: '2026-08-12', flowIntensity: 'light' },
      { date: '2026-08-13', flowIntensity: 'none' },
      { date: '2026-09-07', flowIntensity: 'medium' }, // still running — excluded
      { date: '2026-09-08', flowIntensity: 'heavy' },
    ];
    expect(averagePeriodLengthDays(days)).toBe(2); // (1 + 3) / 2
  });

  it('a gap in logging (not a real no-flow day) still confirms the earlier streak ended', () => {
    const days = [
      { date: '2026-08-01', flowIntensity: 'medium' },
      { date: '2026-08-02', flowIntensity: 'heavy' },
      { date: '2026-08-15', flowIntensity: 'medium' }, // clearly a new, later streak
    ];
    // the 08-01/08-02 streak isn't consecutive with 08-15, so it's
    // confirmed closed even without an explicit "none" day in between;
    // the 08-15 streak is the trailing one and gets excluded instead.
    expect(averagePeriodLengthDays(days)).toBe(2);
  });

  it('sorts unsorted input before computing streaks', () => {
    const shuffled = [
      { date: '2026-08-04', flowIntensity: 'none' },
      { date: '2026-08-01', flowIntensity: 'medium' },
      { date: '2026-08-03', flowIntensity: 'light' },
      { date: '2026-08-02', flowIntensity: 'heavy' },
    ];
    expect(averagePeriodLengthDays(shuffled)).toBe(3);
  });
});
