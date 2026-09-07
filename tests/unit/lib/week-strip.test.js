import { describe, expect, it } from 'vitest';
import { buildWeekStrip } from '../../../js/lib/week-strip.js';

describe('buildWeekStrip', () => {
  const today = new Date('2026-03-15T12:00:00Z');

  it('returns 7 days ending today, oldest first', () => {
    const days = buildWeekStrip(new Set(), new Set(), today);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-03-09');
    expect(days[6].date).toBe('2026-03-15');
    expect(days[6].isToday).toBe(true);
    expect(days[0].isToday).toBe(false);
  });

  it('marks a day with no entry as neither logged nor goal-met', () => {
    const days = buildWeekStrip(new Set(), new Set(), today);
    for (const day of days) {
      expect(day.hasEntry).toBe(false);
      expect(day.goalMet).toBe(false);
    }
  });

  it('marks a logged day that missed goal as hasEntry but not goalMet', () => {
    const days = buildWeekStrip(new Set(['2026-03-14']), new Set(), today);
    const day = days.find((d) => d.date === '2026-03-14');
    expect(day.hasEntry).toBe(true);
    expect(day.goalMet).toBe(false);
  });

  it('marks a goal-met day as both hasEntry and goalMet', () => {
    const days = buildWeekStrip(new Set(['2026-03-14']), new Set(['2026-03-14']), today);
    const day = days.find((d) => d.date === '2026-03-14');
    expect(day.hasEntry).toBe(true);
    expect(day.goalMet).toBe(true);
  });

  it('supports a custom window length', () => {
    const days = buildWeekStrip(new Set(), new Set(), today, 3);
    expect(days).toHaveLength(3);
    expect(days.map((d) => d.date)).toEqual(['2026-03-13', '2026-03-14', '2026-03-15']);
  });
});
