import { describe, expect, it } from 'vitest';
import { calculateReadiness, readinessActionSuggestion } from '../../../js/features/recovery/readiness.js';

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

describe('readinessActionSuggestion: a plain-language nudge per category', () => {
  it('gives a distinct, non-empty suggestion for each real category', () => {
    const high = readinessActionSuggestion('high');
    const moderate = readinessActionSuggestion('moderate');
    const low = readinessActionSuggestion('low');
    expect(new Set([high, moderate, low]).size).toBe(3); // three genuinely different messages
    for (const message of [high, moderate, low]) {
      expect(message.length).toBeGreaterThan(10);
    }
  });

  it('never phrases it as an instruction — "worth" and "if you want", not "must" or "should"', () => {
    for (const category of ['high', 'moderate', 'low']) {
      const message = readinessActionSuggestion(category).toLowerCase();
      expect(message).not.toMatch(/\bmust\b|\byou should\b/);
    }
  });
});

describe('calculateReadiness: sleep debt adds context without changing the score', () => {
  it('flags a notable sleep debt in the reasoning', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, sleepDebtMinutes: 150 });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('sleep debt'))).toBe(true);
  });

  it('stays quiet about a trivial debt', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, sleepDebtMinutes: 20 });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('sleep debt'))).toBe(false);
  });

  it('never mentions debt when none was passed at all — no invented number for someone with no Sleep logs', () => {
    const result = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1 });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('sleep debt'))).toBe(false);
  });

  it('does not change the score itself — debt is reasoning context, not a second sleep input', () => {
    const withoutDebt = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1 });
    const withDebt = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, sleepDebtMinutes: 300 });
    expect(withDebt.score).toBe(withoutDebt.score);
    expect(withDebt.category).toBe(withoutDebt.category);
  });
});

describe('calculateReadiness: ACWR replaces the crude session-count load score once real history exists', () => {
  it('with no acwr passed at all, behaves exactly as before (recentSessionCount fallback)', () => {
    const withoutAcwr = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, recentSessionCount: 3 });
    const explicitNullRatio = calculateReadiness({
      sleepHours: 8,
      energyLevel: 5,
      sorenessLevel: 1,
      recentSessionCount: 3,
      acwr: { ratio: null, category: null },
    });
    // Same real return shape calculateAcuteChronicWorkloadRatio itself
    // gives before a real week of session-RPE history exists — must fall
    // back exactly like omitting acwr entirely.
    expect(explicitNullRatio.score).toBe(withoutAcwr.score);
    expect(explicitNullRatio.reasoning).toEqual(withoutAcwr.reasoning);
  });

  it('a real sweet-spot ratio (0.8-1.3) scores load higher than a heavy recentSessionCount would have', () => {
    const fallback = calculateReadiness({ sleepHours: 7, energyLevel: 3, sorenessLevel: 3, recentSessionCount: 3 });
    const withAcwr = calculateReadiness({
      sleepHours: 7,
      energyLevel: 3,
      sorenessLevel: 3,
      recentSessionCount: 3, // present but must be ignored once a real ratio exists
      acwr: { ratio: 1.0, category: 'sweet-spot' },
    });
    expect(withAcwr.score).toBeGreaterThan(fallback.score);
  });

  it('a real high-risk ratio pulls the score down and names the real Gabbett 2016 "danger zone" finding once it crosses 1.5', () => {
    const result = calculateReadiness({
      sleepHours: 8,
      energyLevel: 4,
      sorenessLevel: 2,
      acwr: { ratio: 1.8, category: 'high-risk' },
    });
    expect(result.reasoning.some((r) => r.includes('1.80'))).toBe(true);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('gabbett'))).toBe(true);
  });

  it('a high-risk ratio between 1.3 and 1.5 is flagged, but without the specific 1.5 "danger zone" citation', () => {
    const result = calculateReadiness({
      sleepHours: 8,
      energyLevel: 4,
      sorenessLevel: 2,
      acwr: { ratio: 1.4, category: 'high-risk' },
    });
    expect(result.reasoning.some((r) => r.includes('1.40'))).toBe(true);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('gabbett'))).toBe(false);
  });

  it('a building-zone ratio (<0.8) scores the load component at its honest ceiling — low recent load isn\'t itself a cited risk finding', () => {
    const result = calculateReadiness({
      sleepHours: 7,
      energyLevel: 3,
      sorenessLevel: 3,
      acwr: { ratio: 0.3, category: 'building' },
    });
    // Load never drags the reasoning down when it's this low.
    expect(result.reasoning.some((r) => r.toLowerCase().includes('acute:chronic'))).toBe(false);
  });

  it('a real ACWR ratio never pushes the overall score outside 0-100, even at an extreme spike', () => {
    const result = calculateReadiness({
      sleepHours: 8,
      energyLevel: 5,
      sorenessLevel: 1,
      acwr: { ratio: 5, category: 'high-risk' },
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('calculateReadiness: a real HRV baseline deviation adds a new component, never required', () => {
  it('with no hrvDeviation passed at all, behaves exactly as before', () => {
    const withoutHrv = calculateReadiness({ sleepHours: 8, energyLevel: 5, sorenessLevel: 1, recentSessionCount: 0 });
    const explicitNullDeviation = calculateReadiness({
      sleepHours: 8,
      energyLevel: 5,
      sorenessLevel: 1,
      recentSessionCount: 0,
      hrvDeviation: { deviationPercent: null, category: null },
    });
    // Same real return shape calculateHrvBaselineDeviation itself gives
    // before a real personal baseline exists — must fall back exactly
    // like omitting hrvDeviation entirely.
    expect(explicitNullDeviation.score).toBe(withoutHrv.score);
    expect(explicitNullDeviation.reasoning).toEqual(withoutHrv.reasoning);
  });

  it('hrvDeviation alone (with no real self-reported input) still isn\'t a real check-in', () => {
    expect(calculateReadiness({ hrvDeviation: { deviationPercent: -20, category: 'below-baseline' } })).toBeNull();
  });

  it('a real drop below baseline scores lower than an identical check-in with no HRV data at all', () => {
    const withoutHrv = calculateReadiness({ sleepHours: 7, energyLevel: 3, sorenessLevel: 3 });
    const withDrop = calculateReadiness({
      sleepHours: 7,
      energyLevel: 3,
      sorenessLevel: 3,
      hrvDeviation: { deviationPercent: -25, category: 'below-baseline' },
    });
    expect(withDrop.score).toBeLessThan(withoutHrv.score);
  });

  it('names the real Plews et al. HRV-baseline research once a drop is notable enough to flag', () => {
    const result = calculateReadiness({
      sleepHours: 8,
      energyLevel: 4,
      sorenessLevel: 2,
      hrvDeviation: { deviationPercent: -25, category: 'below-baseline' },
    });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('hrv'))).toBe(true);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('plews'))).toBe(true);
    expect(result.reasoning.some((r) => r.includes('25%'))).toBe(true);
  });

  it('a reading at baseline is quiet in the reasoning — nothing notable to flag', () => {
    const result = calculateReadiness({
      sleepHours: 8,
      energyLevel: 5,
      sorenessLevel: 1,
      hrvDeviation: { deviationPercent: 2, category: 'at-baseline' },
    });
    expect(result.reasoning.some((r) => r.toLowerCase().includes('hrv'))).toBe(false);
  });

  it('a large rise above baseline is named, but never phrased as unambiguously good', () => {
    const result = calculateReadiness({
      sleepHours: 8,
      energyLevel: 5,
      sorenessLevel: 1,
      hrvDeviation: { deviationPercent: 30, category: 'above-baseline' },
    });
    const hrvLine = result.reasoning.find((r) => r.toLowerCase().includes('hrv'));
    expect(hrvLine).toBeTruthy();
    expect(hrvLine.toLowerCase()).toMatch(/incomplete recovery|not.*unambiguous|not.*straightforward|worth reading/);
  });

  it('a real HRV deviation never pushes the overall score outside 0-100, even at an extreme drop', () => {
    const result = calculateReadiness({
      sleepHours: 4,
      energyLevel: 1,
      sorenessLevel: 5,
      recentSessionCount: 5,
      hrvDeviation: { deviationPercent: -80, category: 'below-baseline' },
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('a real HRV deviation and a real ACWR spike can both contribute at once, fully backward compatible with either alone', () => {
    const result = calculateReadiness({
      sleepHours: 7,
      energyLevel: 3,
      sorenessLevel: 3,
      acwr: { ratio: 1.8, category: 'high-risk' },
      hrvDeviation: { deviationPercent: -25, category: 'below-baseline' },
    });
    expect(result).not.toBeNull();
    expect(result.reasoning.some((r) => r.toLowerCase().includes('gabbett'))).toBe(true);
    expect(result.reasoning.some((r) => r.toLowerCase().includes('plews'))).toBe(true);
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
