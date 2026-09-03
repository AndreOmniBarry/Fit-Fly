import { describe, expect, it } from 'vitest';
import {
  averageHydrationPerLoggedDay,
  bestHydrationDayEver,
  calculateHydrationStreak,
  groupHydrationByDate,
} from '../../../js/features/hydration/hydration-trend.js';

describe('groupHydrationByDate', () => {
  it('sums multiple entries on the same day into one real daily total', () => {
    const entries = [
      { date: '2026-03-15', amountMl: 250 },
      { date: '2026-03-15', amountMl: 500 },
      { date: '2026-03-14', amountMl: 300 },
    ];
    const totals = groupHydrationByDate(entries);
    expect(totals.get('2026-03-15')).toBe(750);
    expect(totals.get('2026-03-14')).toBe(300);
    expect(totals.size).toBe(2);
  });
});

describe('calculateHydrationStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateHydrationStreak([])).toBe(0);
  });

  it('is 1 with a single day logged, even across multiple entries', () => {
    const entries = [
      { date: '2026-03-15', amountMl: 250 },
      { date: '2026-03-15', amountMl: 250 },
    ];
    expect(calculateHydrationStreak(entries)).toBe(1);
  });

  it('counts consecutive days ending at the most recent', () => {
    const entries = [
      { date: '2026-03-13', amountMl: 500 },
      { date: '2026-03-14', amountMl: 500 },
      { date: '2026-03-15', amountMl: 500 },
    ];
    expect(calculateHydrationStreak(entries)).toBe(3);
  });

  it('breaks on any gap, only counting the run up to the most recent day', () => {
    const entries = [
      { date: '2026-03-10', amountMl: 500 },
      { date: '2026-03-14', amountMl: 500 },
      { date: '2026-03-15', amountMl: 500 },
    ];
    expect(calculateHydrationStreak(entries)).toBe(2);
  });
});

describe('bestHydrationDayEver', () => {
  it('is null with nothing logged', () => {
    expect(bestHydrationDayEver([])).toBeNull();
  });

  it('finds the real highest day across the whole history, summing same-day entries first', () => {
    const entries = [
      { date: '2026-01-01', amountMl: 1500 }, // months earlier, split across two drinks
      { date: '2026-01-01', amountMl: 1000 },
      { date: '2026-03-15', amountMl: 800 },
    ];
    expect(bestHydrationDayEver(entries)).toEqual({ date: '2026-01-01', amountMl: 2500 });
  });
});

describe('averageHydrationPerLoggedDay', () => {
  const today = new Date('2026-03-15T12:00:00Z');

  it('is 0 with nothing logged in the window', () => {
    expect(averageHydrationPerLoggedDay([], 7, today)).toBe(0);
  });

  it('averages per logged day, not diluted by unlogged days, and sums same-day entries first', () => {
    const entries = [
      { date: '2026-03-14', amountMl: 1000 },
      { date: '2026-03-15', amountMl: 500 },
      { date: '2026-03-15', amountMl: 500 }, // second drink, same day
    ];
    // day totals: 3/14 -> 1000, 3/15 -> 1000. avg = (1000+1000)/2 = 1000
    expect(averageHydrationPerLoggedDay(entries, 7, today)).toBe(1000);
  });

  it('excludes entries outside the window', () => {
    const entries = [
      { date: '2026-03-01', amountMl: 3000 }, // well outside a 7-day window
      { date: '2026-03-15', amountMl: 800 },
    ];
    expect(averageHydrationPerLoggedDay(entries, 7, today)).toBe(800);
  });
});
