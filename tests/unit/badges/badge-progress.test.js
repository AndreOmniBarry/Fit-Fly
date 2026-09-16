import { describe, expect, it } from 'vitest';
import { closestLockedBadge } from '../../../js/features/badges/badge-progress.js';

function status(overrides) {
  return {
    id: 'test',
    name: 'Test Badge',
    category: 'Test',
    icon: 'star',
    threshold: 10,
    metricLabel: 'widgets',
    basis: 'A test basis.',
    earned: false,
    currentValue: 0,
    ...overrides,
  };
}

describe('closestLockedBadge', () => {
  it('returns null when there are no badges at all', () => {
    expect(closestLockedBadge([])).toBeNull();
  });

  it('returns null once every real badge is earned — never a fabricated nudge', () => {
    const badges = [status({ id: 'a', earned: true, currentValue: 10 }), status({ id: 'b', earned: true, currentValue: 20, threshold: 20 })];
    expect(closestLockedBadge(badges)).toBeNull();
  });

  it('picks the single locked badge, ignoring already-earned ones', () => {
    const badges = [status({ id: 'a', earned: true, currentValue: 10 }), status({ id: 'b', currentValue: 4, threshold: 10 })];
    expect(closestLockedBadge(badges)?.id).toBe('b');
  });

  it('picks the highest real progress ratio, not the highest raw currentValue', () => {
    // "b" is closer by ratio (4/5 = 0.8) despite a smaller raw currentValue than "a" (6/30 = 0.2).
    const badges = [status({ id: 'a', currentValue: 6, threshold: 30 }), status({ id: 'b', currentValue: 4, threshold: 5 })];
    expect(closestLockedBadge(badges)?.id).toBe('b');
  });

  it('breaks a tie by keeping the catalog\'s own order — the first match', () => {
    const badges = [status({ id: 'a', currentValue: 3, threshold: 6 }), status({ id: 'b', currentValue: 5, threshold: 10 })];
    expect(closestLockedBadge(badges)?.id).toBe('a');
  });

  it('never lets a currentValue of 0 crash the comparison', () => {
    const badges = [status({ id: 'a', currentValue: 0, threshold: 10 })];
    expect(closestLockedBadge(badges)?.id).toBe('a');
  });
});
