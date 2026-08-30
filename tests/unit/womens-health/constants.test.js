import { describe, expect, it } from 'vitest';
import { derivePeriodStartDates } from '../../../js/features/womens-health/constants.js';

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
