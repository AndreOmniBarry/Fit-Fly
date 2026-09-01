import { describe, expect, it } from 'vitest';
import { goalNeedsTodaysNudge, goalsNeedingTodaysNudge } from '../../../js/features/goals/reminders.js';

describe('goalNeedsTodaysNudge', () => {
  it('a goal with no history at all needs a nudge', () => {
    expect(goalNeedsTodaysNudge({ history: [] }, '2026-03-15')).toBe(true);
    expect(goalNeedsTodaysNudge({}, '2026-03-15')).toBe(true); // history missing entirely
  });

  it('a goal last logged today does not need a nudge', () => {
    const goal = { history: [{ value: 5, loggedAt: '2026-03-15T08:00:00.000Z' }] };
    expect(goalNeedsTodaysNudge(goal, '2026-03-15')).toBe(false);
  });

  it('a goal last logged on an earlier day needs a nudge', () => {
    const goal = { history: [{ value: 5, loggedAt: '2026-03-14T08:00:00.000Z' }] };
    expect(goalNeedsTodaysNudge(goal, '2026-03-15')).toBe(true);
  });

  it('only the most recent entry matters, not the whole history', () => {
    const goal = {
      history: [
        { value: 1, loggedAt: '2026-03-01T08:00:00.000Z' },
        { value: 5, loggedAt: '2026-03-15T08:00:00.000Z' },
      ],
    };
    expect(goalNeedsTodaysNudge(goal, '2026-03-15')).toBe(false);
  });
});

describe('goalsNeedingTodaysNudge', () => {
  it('filters to just the goals that need one', () => {
    const goals = [
      { name: 'A', history: [{ value: 1, loggedAt: '2026-03-15T08:00:00.000Z' }] }, // logged today
      { name: 'B', history: [{ value: 1, loggedAt: '2026-03-10T08:00:00.000Z' }] }, // stale
      { name: 'C', history: [] }, // never logged
    ];
    const result = goalsNeedingTodaysNudge(goals, '2026-03-15');
    expect(result.map((g) => g.name)).toEqual(['B', 'C']);
  });
});
