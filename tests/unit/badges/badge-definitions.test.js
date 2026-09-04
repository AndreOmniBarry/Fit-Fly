import { describe, expect, it } from 'vitest';
import { BADGE_GROUPS, evaluateBadgeGroup } from '../../../js/features/badges/badge-definitions.js';

describe('evaluateBadgeGroup', () => {
  const group = {
    id: 'test-group',
    category: 'Test',
    icon: 'star',
    metricLabel: 'widgets made',
    basis: 'A test basis.',
    tiers: [
      { id: 'test-3', threshold: 3, name: 'Three' },
      { id: 'test-7', threshold: 7, name: 'Seven' },
      { id: 'test-30', threshold: 30, name: 'Thirty' },
    ],
  };

  it('marks no tier earned at zero', () => {
    const result = evaluateBadgeGroup(group, 0);
    expect(result.every((t) => !t.earned)).toBe(true);
  });

  it('marks only the tiers whose threshold has been reached', () => {
    const result = evaluateBadgeGroup(group, 5);
    expect(result.find((t) => t.id === 'test-3').earned).toBe(true);
    expect(result.find((t) => t.id === 'test-7').earned).toBe(false);
    expect(result.find((t) => t.id === 'test-30').earned).toBe(false);
  });

  it('marks a tier earned exactly at its threshold, not just past it', () => {
    const result = evaluateBadgeGroup(group, 7);
    expect(result.find((t) => t.id === 'test-7').earned).toBe(true);
  });

  it('marks every tier earned once the value clears the highest threshold', () => {
    const result = evaluateBadgeGroup(group, 100);
    expect(result.every((t) => t.earned)).toBe(true);
  });

  it('carries the group\'s category/icon/metricLabel/basis onto every tier, and the real current value', () => {
    const [tier] = evaluateBadgeGroup(group, 5);
    expect(tier.category).toBe('Test');
    expect(tier.icon).toBe('star');
    expect(tier.metricLabel).toBe('widgets made');
    expect(tier.basis).toBe('A test basis.');
    expect(tier.currentValue).toBe(5);
  });
});

describe('BADGE_GROUPS catalog', () => {
  it('every group has at least one tier, listed ascending by threshold', () => {
    for (const group of BADGE_GROUPS) {
      expect(group.tiers.length).toBeGreaterThan(0);
      const thresholds = group.tiers.map((t) => t.threshold);
      const sorted = [...thresholds].sort((a, b) => a - b);
      expect(thresholds).toEqual(sorted);
    }
  });

  it('every badge id across the whole catalog is unique — no two tiers could collide in storage', () => {
    const ids = BADGE_GROUPS.flatMap((g) => g.tiers.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every group id is also unique', () => {
    const groupIds = BADGE_GROUPS.map((g) => g.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
  });
});
