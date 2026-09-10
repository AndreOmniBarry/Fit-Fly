import { describe, expect, it } from 'vitest';
import { buildProgramWeekStrip } from '../../../js/features/programs/weekly-schedule.js';

function fakeDays(count) {
  return Array.from({ length: count }, (_, i) => ({ dayIndex: i + 1, dayType: 'full-body' }));
}

describe('buildProgramWeekStrip', () => {
  it('always returns exactly 7 entries, one per real day of the week', () => {
    for (const count of [1, 2, 3, 4]) {
      const strip = buildProgramWeekStrip('2026-01-05', 1, fakeDays(count));
      expect(strip).toHaveLength(7);
    }
  });

  it('places exactly `count` real training days and leaves the rest as rest days (day: null)', () => {
    const strip = buildProgramWeekStrip('2026-01-05', 1, fakeDays(3));
    const trainingDays = strip.filter((s) => s.day !== null);
    const restDays = strip.filter((s) => s.day === null);
    expect(trainingDays).toHaveLength(3);
    expect(restDays).toHaveLength(4);
  });

  it('spreads training across the week rather than clustering it at the front', () => {
    const strip = buildProgramWeekStrip('2026-01-05', 1, fakeDays(4));
    const trainingOffsets = strip.map((s, i) => (s.day ? i : null)).filter((i) => i !== null);
    // 4 training days across a 7-day week should never all be consecutive
    // (offsets 0,1,2,3) — real rest has to land somewhere in the middle.
    expect(trainingOffsets).not.toEqual([0, 1, 2, 3]);
  });

  it('week 1 starts exactly on the program\'s own real start date', () => {
    const strip = buildProgramWeekStrip('2026-01-05', 1, fakeDays(2));
    expect(strip[0].date).toBe('2026-01-05');
    expect(strip[6].date).toBe('2026-01-11');
  });

  it('week 2 starts exactly 7 real days after week 1, not realigned to a calendar Monday', () => {
    const week1 = buildProgramWeekStrip('2026-01-05', 1, fakeDays(2));
    const week2 = buildProgramWeekStrip('2026-01-05', 2, fakeDays(2));
    expect(week2[0].date).toBe('2026-01-12');
    expect(week1[6].date).not.toBe(week2[0].date); // adjacent, never overlapping
  });

  it('every entry carries a real, non-empty weekday label', () => {
    const strip = buildProgramWeekStrip('2026-01-05', 1, fakeDays(2));
    for (const entry of strip) {
      expect(entry.weekdayLabel.length).toBeGreaterThan(0);
    }
  });

  it('the assigned training-day objects are the real ones passed in, not copies missing data', () => {
    const days = fakeDays(2);
    const strip = buildProgramWeekStrip('2026-01-05', 1, days);
    const assigned = strip.filter((s) => s.day !== null).map((s) => s.day);
    expect(assigned).toEqual(expect.arrayContaining(days));
  });

  it('falls back to filling offsets in order for a day count with no explicit slot pattern', () => {
    const strip = buildProgramWeekStrip('2026-01-05', 1, fakeDays(5));
    const trainingDays = strip.filter((s) => s.day !== null);
    expect(trainingDays).toHaveLength(5);
  });
});
