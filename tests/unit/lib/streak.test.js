import { describe, expect, it } from 'vitest';
import { calculateStreak } from '../../../js/lib/streak.js';

describe('calculateStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('is 1 with a single day logged', () => {
    expect(calculateStreak(['2026-03-15'])).toBe(1);
  });

  it('counts consecutive days ending at the most recent', () => {
    expect(calculateStreak(['2026-03-13', '2026-03-14', '2026-03-15'])).toBe(3);
  });

  it('breaks on any gap, only counting the run up to the most recent day', () => {
    expect(calculateStreak(['2026-03-10', '2026-03-14', '2026-03-15'])).toBe(2);
  });

  it('collapses duplicate dates into one streak day', () => {
    expect(calculateStreak(['2026-03-15', '2026-03-15', '2026-03-14'])).toBe(2);
  });

  it('is order-independent — the same result regardless of input order', () => {
    const forward = calculateStreak(['2026-03-13', '2026-03-14', '2026-03-15']);
    const shuffled = calculateStreak(['2026-03-15', '2026-03-13', '2026-03-14']);
    expect(shuffled).toBe(forward);
  });
});
