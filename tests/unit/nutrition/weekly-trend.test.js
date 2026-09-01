import { describe, expect, it } from 'vitest';
import { lastNDaysRange, summarizeWeeklyNutrition } from '../../../js/features/nutrition/weekly-trend.js';

describe('lastNDaysRange', () => {
  it('spans exactly `days` calendar days ending on `today`, inclusive', () => {
    const today = new Date('2026-03-15T12:00:00Z');
    const range = lastNDaysRange(7, today);
    expect(range.endDate).toBe('2026-03-15');
    expect(range.startDate).toBe('2026-03-09'); // 7 days: 9,10,11,12,13,14,15
    expect(range.dayCount).toBe(7);
  });

  it('crosses a month boundary correctly', () => {
    const today = new Date('2026-03-03T00:00:00Z');
    const range = lastNDaysRange(7, today);
    expect(range.startDate).toBe('2026-02-25');
    expect(range.endDate).toBe('2026-03-03');
  });
});

describe('summarizeWeeklyNutrition', () => {
  it('is null with nothing logged in the window at all', () => {
    expect(summarizeWeeklyNutrition([])).toBeNull();
  });

  it('averages per logged day, not diluted by unlogged days in the window', () => {
    const entries = [
      { date: '2026-03-14', calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
      { date: '2026-03-15', calories: 1800, proteinG: 130, carbsG: 180, fatG: 50 },
    ];
    // only 2 of 7 days logged
    const result = summarizeWeeklyNutrition(entries, 7);
    expect(result.daysLogged).toBe(2);
    expect(result.dayCount).toBe(7);
    expect(result.avgCalories).toBe(1900); // (2000+1800)/2, not /7
    expect(result.avgProteinG).toBe(140);
  });

  it('sums multiple entries on the same day before averaging across days', () => {
    const entries = [
      { date: '2026-03-15', calories: 500, proteinG: 30, carbsG: 40, fatG: 10 },
      { date: '2026-03-15', calories: 700, proteinG: 40, carbsG: 60, fatG: 20 }, // same day, second meal
      { date: '2026-03-14', calories: 1200, proteinG: 90, carbsG: 100, fatG: 30 },
    ];
    const result = summarizeWeeklyNutrition(entries, 7);
    expect(result.daysLogged).toBe(2);
    // day 1: 500+700=1200, day 2: 1200 -> avg 1200
    expect(result.avgCalories).toBe(1200);
  });
});
