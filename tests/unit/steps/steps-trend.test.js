import { describe, expect, it } from 'vitest';
import { averageStepsPerLoggedDay, calculateStepsStreak } from '../../../js/features/steps/steps-trend.js';

describe('calculateStepsStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateStepsStreak([])).toBe(0);
  });

  it('is 1 with a single day logged', () => {
    expect(calculateStepsStreak([{ date: '2026-03-15', steps: 4000 }])).toBe(1);
  });

  it('counts consecutive days ending at the most recent', () => {
    const entries = [
      { date: '2026-03-13', steps: 5000 },
      { date: '2026-03-14', steps: 6000 },
      { date: '2026-03-15', steps: 7000 },
    ];
    expect(calculateStepsStreak(entries)).toBe(3);
  });

  it('breaks on any gap, only counting the run up to the most recent day', () => {
    const entries = [
      { date: '2026-03-10', steps: 5000 },
      { date: '2026-03-14', steps: 6000 },
      { date: '2026-03-15', steps: 7000 },
    ];
    expect(calculateStepsStreak(entries)).toBe(2);
  });
});

describe('averageStepsPerLoggedDay', () => {
  const today = new Date('2026-03-15T12:00:00Z');

  it('is 0 with nothing logged in the window', () => {
    expect(averageStepsPerLoggedDay([], 7, today)).toBe(0);
  });

  it('averages per logged day, not diluted by unlogged days in the window', () => {
    const entries = [
      { date: '2026-03-14', steps: 8000 },
      { date: '2026-03-15', steps: 6000 },
    ];
    // only 2 of 7 days logged
    expect(averageStepsPerLoggedDay(entries, 7, today)).toBe(7000); // (8000+6000)/2, not /7
  });

  it('excludes entries outside the window', () => {
    const entries = [
      { date: '2026-03-01', steps: 20000 }, // well outside a 7-day window
      { date: '2026-03-15', steps: 6000 },
    ];
    expect(averageStepsPerLoggedDay(entries, 7, today)).toBe(6000);
  });
});
