import { describe, expect, it } from 'vitest';
import { newlyCrossedMilestones } from '../../../js/features/goals/milestones.js';

describe('newlyCrossedMilestones', () => {
  it('is empty when progress hasn\'t moved at all', () => {
    expect(newlyCrossedMilestones(10, 10)).toEqual([]);
  });

  it('is empty for movement that stays below every threshold', () => {
    expect(newlyCrossedMilestones(5, 20)).toEqual([]);
  });

  it('reports a single threshold crossed', () => {
    expect(newlyCrossedMilestones(20, 30)).toEqual([25]);
  });

  it('reports multiple thresholds crossed in one jump (a big single update)', () => {
    expect(newlyCrossedMilestones(10, 80)).toEqual([25, 50, 75]);
  });

  it('never re-reports a threshold already passed', () => {
    expect(newlyCrossedMilestones(60, 70)).toEqual([]); // already past 25 and 50
  });

  it('excludes 100 — that stays goal-progress.js\'s own achieved path', () => {
    expect(newlyCrossedMilestones(80, 100)).toEqual([]);
  });

  it('landing exactly on a threshold counts as crossing it', () => {
    expect(newlyCrossedMilestones(24, 25)).toEqual([25]);
  });
});
