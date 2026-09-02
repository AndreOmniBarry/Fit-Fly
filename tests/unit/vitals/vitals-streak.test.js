import { describe, expect, it } from 'vitest';
import { calculateVitalsStreak } from '../../../js/features/vitals/vitals-streak.js';

describe('calculateVitalsStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateVitalsStreak([])).toBe(0);
  });

  it('is 1 with a single day logged', () => {
    expect(calculateVitalsStreak(['2026-03-15'])).toBe(1);
  });

  it('counts consecutive days ending at the most recent', () => {
    expect(calculateVitalsStreak(['2026-03-13', '2026-03-14', '2026-03-15'])).toBe(3);
  });

  it('breaks on any gap, only counting the run up to the most recent day', () => {
    expect(calculateVitalsStreak(['2026-03-10', '2026-03-14', '2026-03-15'])).toBe(2);
  });

  it('collapses multiple readings on the same day into one streak day (BP and SpO2 both count)', () => {
    // Same day appearing twice — once for a BP reading, once for SpO2 —
    // must not double-count or otherwise distort the streak.
    expect(calculateVitalsStreak(['2026-03-15', '2026-03-15', '2026-03-14'])).toBe(2);
  });
});
