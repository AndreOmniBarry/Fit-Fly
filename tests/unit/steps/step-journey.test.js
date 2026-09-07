import { describe, expect, it } from 'vitest';
import { buildStepTrailMilestones, stepTrailProgress } from '../../../js/features/steps/step-journey.js';

describe('stepTrailProgress', () => {
  it('is 0 with no steps', () => {
    expect(stepTrailProgress(0, 7500)).toBe(0);
  });

  it('is a real fraction of the way to goal', () => {
    expect(stepTrailProgress(3750, 7500)).toBe(0.5);
  });

  it('clamps at 1 once the goal is beaten', () => {
    expect(stepTrailProgress(10000, 7500)).toBe(1);
  });

  it('is 0 with an invalid (zero/negative) goal, never a divide-by-zero', () => {
    expect(stepTrailProgress(5000, 0)).toBe(0);
    expect(stepTrailProgress(5000, -100)).toBe(0);
  });
});

describe('buildStepTrailMilestones', () => {
  it('marks only the reached milestones at 50% progress', () => {
    const milestones = buildStepTrailMilestones(3750, 7500);
    expect(milestones).toEqual([
      { fraction: 0, reached: true },
      { fraction: 0.25, reached: true },
      { fraction: 0.5, reached: true },
      { fraction: 0.75, reached: false },
      { fraction: 1, reached: false },
    ]);
  });

  it('reaches every milestone once the goal is met', () => {
    const milestones = buildStepTrailMilestones(7500, 7500);
    expect(milestones.every((m) => m.reached)).toBe(true);
  });

  it('reaches only the starting milestone with zero steps', () => {
    const milestones = buildStepTrailMilestones(0, 7500);
    expect(milestones[0].reached).toBe(true);
    expect(milestones.slice(1).every((m) => !m.reached)).toBe(true);
  });
});
