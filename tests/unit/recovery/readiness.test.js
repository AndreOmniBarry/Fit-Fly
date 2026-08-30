import { describe, expect, it } from 'vitest';
import { calculateReadiness } from '../../../js/features/recovery/readiness.js';

describe('calculateReadiness: basic scoring', () => {
  it('a great night, high energy, no soreness, no recent training scores high', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, recentSessionCount: 0 });
    expect(result.category).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('short sleep, low energy, high soreness, heavy recent training scores low', () => {
    const result = calculateReadiness({ sleepHours: 4, energyLevel: 1, sorenessLevel: 5, recentSessionCount: 3 });
    expect(result.category).toBe('low');
    expect(result.score).toBeLessThan(50);
  });

  it('returns null with no real self-reported input at all', () => {
    expect(calculateReadiness({})).toBeNull();
    expect(calculateReadiness({ recentSessionCount: 2 })).toBeNull(); // load alone isn't a check-in
  });
});

describe('calculateReadiness: partial input still produces a score', () => {
  it('works from sleep alone', () => {
    const result = calculateReadiness({ sleepHours: 8 });
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });

  it('works from soreness alone', () => {
    const result = calculateReadiness({ sorenessLevel: 2 });
    expect(result).not.toBeNull();
  });
});

describe('calculateReadiness: reasoning reflects what actually pulled the score down', () => {
  it('flags short sleep specifically', () => {
    const result = calculateReadiness({ sleepHours: 4, energyLevel: 5, sorenessLevel: 1 });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('sleep'))).toBe(true);
  });

  it('flags soreness specifically', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 5 });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('sorenes'))).toBe(true);
  });

  it('flags recent training load specifically', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, recentSessionCount: 3 });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('trained recently'))).toBe(true);
  });

  it('says everything looks solid when nothing is flagged', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, recentSessionCount: 0 });
    expect(result.reasoning[0]).toMatch(/solid/);
  });
});

describe('calculateReadiness: monotonic sanity checks', () => {
  it('more sleep never scores lower than less sleep, all else equal', () => {
    const lessSleep = calculateReadiness({ sleepHours: 5, energyLevel: 3, sorenessLevel: 3 });
    const moreSleep = calculateReadiness({ sleepHours: 8, energyLevel: 3, sorenessLevel: 3 });
    expect(moreSleep.score).toBeGreaterThanOrEqual(lessSleep.score);
  });

  it('more recent sessions never scores higher, all else equal', () => {
    const lightWeek = calculateReadiness({ sleepHours: 7, energyLevel: 3, sorenessLevel: 3, recentSessionCount: 0 });
    const heavyWeek = calculateReadiness({ sleepHours: 7, energyLevel: 3, sorenessLevel: 3, recentSessionCount: 3 });
    expect(heavyWeek.score).toBeLessThanOrEqual(lightWeek.score);
  });

  it('the score is always between 0 and 100', () => {
    const extremeLow = calculateReadiness({ sleepHours: 0, energyLevel: 1, sorenessLevel: 5, recentSessionCount: 10 });
    const extremeHigh = calculateReadiness({ sleepHours: 12, energyLevel: 5, sorenessLevel: 1, recentSessionCount: 0 });
    expect(extremeLow.score).toBeGreaterThanOrEqual(0);
    expect(extremeHigh.score).toBeLessThanOrEqual(100);
  });
});
