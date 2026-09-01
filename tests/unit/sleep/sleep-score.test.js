import { describe, expect, it } from 'vitest';
import { calculateSleepScore } from '../../../js/features/sleep/sleep-score.js';

function log(date, bedTime, durationMinutes = 480) {
  return { date, bedTime, wakeTime: null, durationMinutes, quality: null, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('calculateSleepScore: basic scoring', () => {
  it('a full night, great quality, consistent bedtimes scores great', () => {
    const recent = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z'),
      log('2024-01-02', '2024-01-02T23:05:00.000Z'),
    ];
    const result = calculateSleepScore({ durationMinutes: 480, quality: 5 }, recent);
    expect(result.category).toBe('great');
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('a short, low-quality, erratic night scores poor', () => {
    const recent = [
      log('2024-01-01', '2024-01-01T21:00:00.000Z'),
      log('2024-01-02', '2024-01-03T02:00:00.000Z'),
    ];
    const result = calculateSleepScore({ durationMinutes: 240, quality: 1 }, recent);
    expect(result.category).toBe('poor');
    expect(result.score).toBeLessThan(50);
  });

  it('works from duration alone with no history or quality rating', () => {
    const result = calculateSleepScore({ durationMinutes: 480, quality: null }, []);
    expect(result.score).toBeGreaterThan(0);
    expect(result.components.consistency).toBeNull();
    expect(result.components.quality).toBeNull();
  });

  it('the score is always between 0 and 100', () => {
    const low = calculateSleepScore({ durationMinutes: 0, quality: 1 }, []);
    const high = calculateSleepScore({ durationMinutes: 700, quality: 5 }, []);
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(high.score).toBeLessThanOrEqual(100);
  });
});

describe('calculateSleepScore: reasoning reflects what pulled the score down', () => {
  it('flags short duration specifically', () => {
    const result = calculateSleepScore({ durationMinutes: 240, quality: 5 }, []);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('short of the'))).toBe(true);
  });

  it('flags long duration specifically too — not just short', () => {
    const result = calculateSleepScore({ durationMinutes: 13 * 60, quality: 5 }, []);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('runs longer than'))).toBe(true);
  });

  it('flags low quality specifically', () => {
    const result = calculateSleepScore({ durationMinutes: 480, quality: 1 }, []);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('rated'))).toBe(true);
  });

  it('flags inconsistent bedtimes specifically', () => {
    const recent = [
      log('2024-01-01', '2024-01-01T20:00:00.000Z'),
      log('2024-01-02', '2024-01-03T03:00:00.000Z'),
    ];
    const result = calculateSleepScore({ durationMinutes: 480, quality: 5 }, recent);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('bedtime'))).toBe(true);
  });

  it('says things look solid when nothing is flagged', () => {
    const recent = [log('2024-01-01', '2024-01-01T23:00:00.000Z'), log('2024-01-02', '2024-01-02T23:00:00.000Z')];
    const result = calculateSleepScore({ durationMinutes: 480, quality: 5 }, recent);
    expect(result.reasoning[0]).toMatch(/solid/i);
  });
});

describe('calculateSleepScore: monotonic sanity checks', () => {
  it('more sleep scores higher while short of the recommended range', () => {
    const less = calculateSleepScore({ durationMinutes: 300, quality: 3 }, []);
    const more = calculateSleepScore({ durationMinutes: 420, quality: 3 }, []);
    expect(more.score).toBeGreaterThanOrEqual(less.score);
  });

  it('is NOT simply "more sleep is always better" — a genuinely long night scores below a solid one', () => {
    // The whole point of the NSF-band model over the old flat-goal one:
    // sleep research is clear that habitually long sleep has its own
    // associated downsides, not just short sleep. See
    // sleep-duration-guideline.ts's own tests for the isolated curve —
    // this just confirms it actually reaches the composite score.
    const solid = calculateSleepScore({ durationMinutes: 480, quality: 3 }, []); // 8h
    const wayLong = calculateSleepScore({ durationMinutes: 13 * 60, quality: 3 }, []); // 13h
    expect(wayLong.score).toBeLessThan(solid.score);
  });

  it('a higher quality rating never scores lower, all else equal', () => {
    const low = calculateSleepScore({ durationMinutes: 480, quality: 1 }, []);
    const high = calculateSleepScore({ durationMinutes: 480, quality: 5 }, []);
    expect(high.score).toBeGreaterThanOrEqual(low.score);
  });

  it('respects age — the same duration scores differently across NSF age bands', () => {
    // 9.5h: within an 18-25-year-old's wider "may be appropriate" range,
    // but past a 65+-year-old's tighter one — see
    // sleep-duration-guideline.ts's own age-band tests for the isolated
    // curve; this confirms it reaches the composite score too.
    const youngAdult = calculateSleepScore({ durationMinutes: 9.5 * 60, quality: null }, [], 20);
    const olderAdult = calculateSleepScore({ durationMinutes: 9.5 * 60, quality: null }, [], 70);
    expect(youngAdult.score).toBeGreaterThan(olderAdult.score);
  });
});
