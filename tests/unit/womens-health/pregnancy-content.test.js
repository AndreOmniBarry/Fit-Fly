import { describe, expect, it } from 'vitest';
import {
  WEEKLY_MILESTONES,
  milestoneForWeek,
  PREGNANCY_SYMPTOMS,
} from '../../../js/features/womens-health/pregnancy-content.js';

describe('WEEKLY_MILESTONES catalog', () => {
  it('every entry has a real, non-empty title and text', () => {
    for (const m of WEEKLY_MILESTONES) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.text.length).toBeGreaterThan(0);
      expect(typeof m.week).toBe('number');
    }
  });

  it('is listed in ascending week order', () => {
    const weeks = WEEKLY_MILESTONES.map((m) => m.week);
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
  });

  it('uses cautious, non-diagnostic language — never a bare medical certainty', () => {
    // Every entry hedges with real uncertainty language rather than
    // stating fetal development as a guaranteed, personal fact.
    const hedgeWords = /typically|usually|often|commonly|around|sometimes|many/i;
    for (const m of WEEKLY_MILESTONES) {
      expect(m.text).toMatch(hedgeWords);
    }
  });
});

describe('milestoneForWeek', () => {
  it('returns the earliest entry for a week before any milestone', () => {
    expect(milestoneForWeek(1)).toBe(WEEKLY_MILESTONES[0]);
  });

  it('returns the latest reached milestone, not a future one', () => {
    const result = milestoneForWeek(15);
    expect(result.week).toBeLessThanOrEqual(15);
    // and it's the closest one under or at 15, not an earlier one
    const laterOnes = WEEKLY_MILESTONES.filter((m) => m.week > result.week && m.week <= 15);
    expect(laterOnes).toHaveLength(0);
  });

  it('returns the final entry for a week past every milestone', () => {
    const lastWeek = WEEKLY_MILESTONES[WEEKLY_MILESTONES.length - 1].week;
    expect(milestoneForWeek(lastWeek + 10)).toBe(WEEKLY_MILESTONES[WEEKLY_MILESTONES.length - 1]);
  });
});

describe('PREGNANCY_SYMPTOMS catalog', () => {
  it('has real, distinct, labeled entries', () => {
    expect(PREGNANCY_SYMPTOMS.length).toBeGreaterThan(0);
    const ids = PREGNANCY_SYMPTOMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of PREGNANCY_SYMPTOMS) expect(s.label.length).toBeGreaterThan(0);
  });
});
