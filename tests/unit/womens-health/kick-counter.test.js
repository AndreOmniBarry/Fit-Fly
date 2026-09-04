import { describe, expect, it } from 'vitest';
import { summarizeKickSession, DEFAULT_KICK_TARGET } from '../../../js/features/womens-health/kick-counter.js';

describe('summarizeKickSession', () => {
  it('is a real 0-count, null-duration session with no taps at all', () => {
    expect(summarizeKickSession([])).toEqual({ count: 0, durationMs: null, reachedTarget: false });
  });

  it('duration is null with only a single tap — no real elapsed span to report', () => {
    expect(summarizeKickSession([1000])).toEqual({ count: 1, durationMs: null, reachedTarget: false });
  });

  it('computes the real elapsed span from first tap to last', () => {
    const result = summarizeKickSession([1000, 5000, 12000]);
    expect(result.count).toBe(3);
    expect(result.durationMs).toBe(11000);
  });

  it('reachedTarget is true once the count meets the default target (10)', () => {
    const taps = Array.from({ length: DEFAULT_KICK_TARGET }, (_, i) => i * 1000);
    expect(summarizeKickSession(taps).reachedTarget).toBe(true);
    expect(summarizeKickSession(taps.slice(0, -1)).reachedTarget).toBe(false);
  });

  it('respects a custom target', () => {
    expect(summarizeKickSession([0, 1000, 2000], 3).reachedTarget).toBe(true);
    expect(summarizeKickSession([0, 1000], 3).reachedTarget).toBe(false);
  });
});
