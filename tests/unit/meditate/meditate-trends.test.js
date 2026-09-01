import { describe, expect, it } from 'vitest';
import {
  calculateMeditationStreak,
  sessionsInLastNDays,
  totalMinutes,
} from '../../../js/features/meditate/meditate-trends.js';

describe('calculateMeditationStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateMeditationStreak([])).toBe(0);
  });

  it('is 1 with a single day logged', () => {
    expect(calculateMeditationStreak([{ date: '2026-03-15', durationSeconds: 120 }])).toBe(1);
  });

  it('counts consecutive days ending at the most recent', () => {
    const sessions = [
      { date: '2026-03-13', durationSeconds: 60 },
      { date: '2026-03-14', durationSeconds: 60 },
      { date: '2026-03-15', durationSeconds: 60 },
    ];
    expect(calculateMeditationStreak(sessions)).toBe(3);
  });

  it('breaks on any gap, only counting the run up to the most recent day', () => {
    const sessions = [
      { date: '2026-03-10', durationSeconds: 60 }, // gap before this
      { date: '2026-03-14', durationSeconds: 60 },
      { date: '2026-03-15', durationSeconds: 60 },
    ];
    expect(calculateMeditationStreak(sessions)).toBe(2);
  });

  it('collapses multiple sessions on the same day into one streak day', () => {
    const sessions = [
      { date: '2026-03-15', durationSeconds: 60 },
      { date: '2026-03-15', durationSeconds: 90 }, // second session, same day
      { date: '2026-03-14', durationSeconds: 60 },
    ];
    expect(calculateMeditationStreak(sessions)).toBe(2);
  });
});

describe('totalMinutes', () => {
  it('is 0 with nothing logged', () => {
    expect(totalMinutes([])).toBe(0);
  });

  it('sums duration across sessions and rounds down to whole minutes', () => {
    const sessions = [
      { date: '2026-03-14', durationSeconds: 90 },
      { date: '2026-03-15', durationSeconds: 100 },
    ];
    // 190s = 3m10s -> floors to 3
    expect(totalMinutes(sessions)).toBe(3);
  });

  it('never inflates a handful of leftover seconds into a minute not really spent', () => {
    expect(totalMinutes([{ date: '2026-03-15', durationSeconds: 45 }])).toBe(0);
  });
});

describe('sessionsInLastNDays', () => {
  const today = new Date('2026-03-15T12:00:00Z');

  it('includes sessions within the window, inclusive of both ends', () => {
    const sessions = [
      { date: '2026-03-09', durationSeconds: 60 }, // exactly 7 days back
      { date: '2026-03-15', durationSeconds: 60 }, // today
    ];
    expect(sessionsInLastNDays(sessions, 7, today)).toHaveLength(2);
  });

  it('excludes sessions outside the window', () => {
    const sessions = [
      { date: '2026-03-08', durationSeconds: 60 }, // 8 days back, outside a 7-day window
      { date: '2026-03-15', durationSeconds: 60 },
    ];
    const result = sessionsInLastNDays(sessions, 7, today);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-15');
  });

  it('is empty with nothing logged', () => {
    expect(sessionsInLastNDays([], 7, today)).toEqual([]);
  });
});
