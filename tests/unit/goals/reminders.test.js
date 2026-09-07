import { describe, expect, it } from 'vitest';
import {
  buildGoalsNotification,
  goalAtStreakRisk,
  goalCloseToTarget,
  goalNeedsTodaysNudge,
  goalsAtStreakRisk,
  goalsCloseToTarget,
  goalsNeedingTodaysNudge,
} from '../../../js/features/goals/reminders.js';
import { CLOSE_TO_TARGET_PHRASES, STREAK_RISK_PHRASES } from '../../../js/features/goals/goal-phrases.js';

function history(...dates) {
  return dates.map((date) => ({ value: 1, loggedAt: `${date}T08:00:00.000Z` }));
}

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

describe('goalAtStreakRisk: real streak, ending yesterday, not yet saved today', () => {
  it('is false with no real history at all — never invents a streak', () => {
    expect(goalAtStreakRisk({ history: [] }, '2026-03-15')).toBe(false);
  });

  it('is false once today is already logged — the streak is already safe', () => {
    const goal = { history: history('2026-03-13', '2026-03-14', '2026-03-15') };
    expect(goalAtStreakRisk(goal, '2026-03-15')).toBe(false);
  });

  it('is false when the streak already broke before yesterday — a nudge cannot save it now', () => {
    const goal = { history: history('2026-03-10', '2026-03-11') };
    expect(goalAtStreakRisk(goal, '2026-03-15')).toBe(false);
  });

  it('is false for a single logged day — a streak of 1 is not yet worth protecting', () => {
    const goal = { history: history('2026-03-14') };
    expect(goalAtStreakRisk(goal, '2026-03-15')).toBe(false);
  });

  it('is true for a real 2+ day streak ending yesterday, not yet logged today', () => {
    const goal = { history: history('2026-03-12', '2026-03-13', '2026-03-14') };
    expect(goalAtStreakRisk(goal, '2026-03-15')).toBe(true);
  });
});

describe('goalsAtStreakRisk', () => {
  it('returns only the at-risk goals, each with its own real streak length', () => {
    const safe = { name: 'Safe', history: history('2026-03-15') };
    const atRisk = { name: 'AtRisk', history: history('2026-03-12', '2026-03-13', '2026-03-14') };
    const result = goalsAtStreakRisk([safe, atRisk], '2026-03-15');
    expect(result).toEqual([{ goal: atRisk, streak: 3 }]);
  });
});

describe('goalCloseToTarget: real logged progress, genuinely close, not yet achieved', () => {
  it('is false at 0% — no progress is never "close"', () => {
    expect(goalCloseToTarget({ direction: 'increase', startValue: 0, currentValue: 0, targetValue: 10 })).toBe(false);
  });

  it('is false below the close threshold', () => {
    expect(goalCloseToTarget({ direction: 'increase', startValue: 0, currentValue: 5, targetValue: 10 })).toBe(false);
  });

  it('is true at or above the close threshold, short of achieved', () => {
    expect(goalCloseToTarget({ direction: 'increase', startValue: 0, currentValue: 9, targetValue: 10 })).toBe(true);
  });

  it('is false once actually achieved — that is a different, already-celebrated moment', () => {
    expect(goalCloseToTarget({ direction: 'increase', startValue: 0, currentValue: 10, targetValue: 10 })).toBe(false);
  });

  it('works the same way for a decreasing goal', () => {
    expect(goalCloseToTarget({ direction: 'decrease', startValue: 80, currentValue: 71, targetValue: 70 })).toBe(true);
  });
});

describe('goalsCloseToTarget', () => {
  it('filters to just the close-but-not-done goals', () => {
    const far = { name: 'Far', direction: 'increase', startValue: 0, currentValue: 1, targetValue: 10 };
    const close = { name: 'Close', direction: 'increase', startValue: 0, currentValue: 9, targetValue: 10 };
    expect(goalsCloseToTarget([far, close]).map((g) => g.name)).toEqual(['Close']);
  });
});

describe('buildGoalsNotification: real data only, one message, correct priority', () => {
  it('is null with no active goals at all — never invents a reason to notify', () => {
    expect(buildGoalsNotification([], '2026-03-15')).toBeNull();
  });

  it('is null when every goal is already logged today and none are close', () => {
    const goal = { name: 'Steady', direction: 'increase', startValue: 0, currentValue: 1, targetValue: 10, history: history('2026-03-15') };
    expect(buildGoalsNotification([goal], '2026-03-15')).toBeNull();
  });

  it('falls back to the plain "not logged today" nudge when nothing else real applies', () => {
    const goal = { name: 'Run a 5K', unit: 'km', direction: 'increase', startValue: 0, currentValue: 0, targetValue: 5, history: [] };
    const result = buildGoalsNotification([goal], '2026-03-15');
    expect(result).toEqual({ title: 'Time to smash your goals today', body: 'Run a 5K' });
  });

  it('prioritizes a real streak at risk over a plain "not logged today" nudge', () => {
    const atRisk = {
      name: 'Daily walk',
      unit: 'steps',
      direction: 'increase',
      startValue: 0,
      currentValue: 1,
      targetValue: 10,
      history: history('2026-03-12', '2026-03-13', '2026-03-14'),
    };
    const result = buildGoalsNotification([atRisk], '2026-03-15', () => 0);
    expect(STREAK_RISK_PHRASES.walk).toContain(result.title);
    expect(result.body).toContain('3-day streak');
  });

  it('prioritizes a real streak at risk over being close to target', () => {
    const atRisk = {
      name: 'Run a 5K',
      unit: 'km',
      direction: 'increase',
      startValue: 0,
      currentValue: 9,
      targetValue: 10,
      history: history('2026-03-12', '2026-03-13', '2026-03-14'),
    };
    const result = buildGoalsNotification([atRisk], '2026-03-15', () => 0);
    expect(result.body).toContain('streak');
  });

  it('uses close-to-target copy for a real close goal with no streak at risk', () => {
    const close = {
      name: 'Drink more water',
      unit: 'ml',
      direction: 'increase',
      startValue: 0,
      currentValue: 9,
      targetValue: 10,
      history: history('2026-03-15'), // already logged today — streak's fine
    };
    const result = buildGoalsNotification([close], '2026-03-15', () => 0);
    expect(result.body).toContain('90%');
    expect(CLOSE_TO_TARGET_PHRASES.hydration).toContain(result.title);
  });

  it('never fires for a goal that does not exist — an empty list is always null', () => {
    expect(buildGoalsNotification([], '2026-03-15', () => 0)).toBeNull();
  });
});
