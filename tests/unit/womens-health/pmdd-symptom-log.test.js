import { describe, expect, it } from 'vitest';
import {
  ALL_PMDD_LOG_ITEMS,
  hasProspectiveDataForTwoCycles,
  PMDD_IMPAIRMENT_ITEM,
  PMDD_SYMPTOM_ITEMS,
  RATING_SCALE,
  recentSevereDayCount,
  scoreDay,
  shouldSurfaceCrisisResource,
  twoMostRecentCompletedCycles,
} from '../../../js/features/womens-health/pmdd-symptom-log.js';

describe('PMDD_SYMPTOM_ITEMS / PMDD_IMPAIRMENT_ITEM / ALL_PMDD_LOG_ITEMS', () => {
  it('has exactly 11 real symptom-criterion items, each with a domain, label, and prompt', () => {
    expect(PMDD_SYMPTOM_ITEMS).toHaveLength(11);
    for (const item of PMDD_SYMPTOM_ITEMS) {
      expect(typeof item.id).toBe('string');
      expect(item.domain.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.prompt.length).toBeGreaterThan(0);
    }
  });

  it('every item id is unique across the 11 symptom items', () => {
    const ids = PMDD_SYMPTOM_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the optional 12th impairment item is Criterion D, kept separate from the 11 symptom items', () => {
    expect(PMDD_IMPAIRMENT_ITEM.domain).toMatch(/Criterion D/);
    expect(PMDD_SYMPTOM_ITEMS.some((i) => i.id === PMDD_IMPAIRMENT_ITEM.id)).toBe(false);
  });

  it('ALL_PMDD_LOG_ITEMS is the 11 symptom items followed by the impairment item, in order', () => {
    expect(ALL_PMDD_LOG_ITEMS).toHaveLength(12);
    expect(ALL_PMDD_LOG_ITEMS.slice(0, 11)).toEqual(PMDD_SYMPTOM_ITEMS);
    expect(ALL_PMDD_LOG_ITEMS[11]).toEqual(PMDD_IMPAIRMENT_ITEM);
  });
});

describe('RATING_SCALE', () => {
  it('is the real 1-5 Not at all/Mild/Moderate/Severe/Extreme scale, in order', () => {
    expect(RATING_SCALE.map((r) => r.value)).toEqual([1, 2, 3, 4, 5]);
    expect(RATING_SCALE.map((r) => r.label)).toEqual(['Not at all', 'Mild', 'Moderate', 'Severe', 'Extreme']);
  });
});

describe('scoreDay', () => {
  it('returns null with no real answers at all', () => {
    expect(scoreDay({})).toBeNull();
  });

  it('returns null when only the impairment item was answered (not a real symptom score)', () => {
    expect(scoreDay({ impairment: 5 })).toBeNull();
  });

  it('ignores out-of-range or non-numeric values rather than letting them skew the average', () => {
    const result = scoreDay({ 'mood-swings': 3, irritability: 0, 'depressed-mood': 6, 'anxiety-tension': 'x' });
    expect(result.answeredCount).toBe(1);
    expect(result.average).toBe(3);
  });

  it('computes a real average across only what was actually answered, out of the real 11-item total', () => {
    const result = scoreDay({ 'mood-swings': 3, irritability: 4 });
    expect(result).toEqual({ answeredCount: 2, totalItems: 11, total: 7, average: 3.5, isSevere: false });
  });

  it('never counts the impairment item toward the symptom-severity average', () => {
    const withImpairment = scoreDay({ 'mood-swings': 1, impairment: 5 });
    const withoutImpairment = scoreDay({ 'mood-swings': 1 });
    expect(withImpairment).toEqual(withoutImpairment);
  });

  it('flags a day severe only once the real average reaches the Severe anchor (4)', () => {
    expect(scoreDay({ 'mood-swings': 4, irritability: 4 }).isSevere).toBe(true);
    expect(scoreDay({ 'mood-swings': 3, irritability: 4 }).isSevere).toBe(false);
  });
});

describe('recentSevereDayCount / shouldSurfaceCrisisResource', () => {
  function severeLog(date) {
    return { date, 'mood-swings': 5, irritability: 5, 'depressed-mood': 5 };
  }
  function mildLog(date) {
    return { date, 'mood-swings': 2, irritability: 2 };
  }

  it('counts 0 with no logs', () => {
    expect(recentSevereDayCount([])).toBe(0);
    expect(shouldSurfaceCrisisResource([])).toBe(false);
  });

  it('does not surface the crisis line for a single severe day', () => {
    const logs = [severeLog('2026-01-01'), mildLog('2026-01-02'), mildLog('2026-01-03')];
    expect(recentSevereDayCount(logs)).toBe(1);
    expect(shouldSurfaceCrisisResource(logs)).toBe(false);
  });

  it('surfaces the crisis line once 3 or more of the recent logged days are severe', () => {
    const logs = [
      severeLog('2026-01-01'),
      severeLog('2026-01-02'),
      mildLog('2026-01-03'),
      severeLog('2026-01-04'),
    ];
    expect(recentSevereDayCount(logs)).toBe(3);
    expect(shouldSurfaceCrisisResource(logs)).toBe(true);
  });

  it('only looks at the most recent window of logged days, not the person\'s entire history', () => {
    // 3 severe days, but all outside a 2-day window of the most recent logs.
    const logs = [
      severeLog('2026-01-01'),
      severeLog('2026-01-02'),
      severeLog('2026-01-03'),
      mildLog('2026-01-04'),
      mildLog('2026-01-05'),
    ];
    expect(recentSevereDayCount(logs, { windowSize: 2 })).toBe(0);
  });
});

describe('twoMostRecentCompletedCycles', () => {
  it('returns null with fewer than 3 distinct period-start dates (fewer than 2 completed cycles)', () => {
    expect(twoMostRecentCompletedCycles([])).toBeNull();
    expect(twoMostRecentCompletedCycles(['2026-01-01'])).toBeNull();
    expect(twoMostRecentCompletedCycles(['2026-01-01', '2026-01-29'])).toBeNull();
  });

  it('returns the 2 real completed-cycle date ranges once 3 period starts exist', () => {
    const result = twoMostRecentCompletedCycles(['2026-01-01', '2026-01-29', '2026-02-26']);
    expect(result).toEqual([
      { start: '2026-01-01', end: '2026-01-29' },
      { start: '2026-01-29', end: '2026-02-26' },
    ]);
  });

  it('picks the 2 most recent cycles, not the earliest, when more history exists', () => {
    // A 4-start history has 3 completed cycles; this asserts the
    // function still returns exactly the most recent 2, not the
    // earliest 2 and not all 3.
    const result = twoMostRecentCompletedCycles(['2025-11-01', '2025-11-29', '2025-12-27', '2026-01-24']);
    expect(result).toEqual([
      { start: '2025-11-29', end: '2025-12-27' },
      { start: '2025-12-27', end: '2026-01-24' },
    ]);
  });
});

describe('hasProspectiveDataForTwoCycles', () => {
  it('is not enough with fewer than 2 completed cycles, and reports the real count', () => {
    const result = hasProspectiveDataForTwoCycles(['2026-01-01', '2026-01-29'], []);
    expect(result.enough).toBe(false);
    expect(result.completedCycles).toBe(1);
    expect(result.coverage).toBeNull();
  });

  it('is not enough with 2 completed cycles but thin daily-log coverage', () => {
    const periodStarts = ['2026-01-01', '2026-01-29', '2026-02-26'];
    const loggedDates = ['2026-01-05', '2026-02-01']; // 1 day logged per 28-day cycle
    const result = hasProspectiveDataForTwoCycles(periodStarts, loggedDates);
    expect(result.enough).toBe(false);
    expect(result.completedCycles).toBe(2);
  });

  it('is enough once 2 completed cycles both have real, adequate daily-log coverage', () => {
    const periodStarts = ['2026-01-01', '2026-01-29', '2026-02-26'];
    // ~90% of each 28-day completed cycle logged (every day but every
    // 10th) — real, adequate prospective coverage, not literally 100%.
    const loggedDates = [];
    for (let offset = 0; offset < 56; offset += 1) {
      if (offset % 10 === 0) continue;
      const d = new Date('2026-01-01T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      loggedDates.push(d.toISOString().slice(0, 10));
    }
    const result = hasProspectiveDataForTwoCycles(periodStarts, loggedDates);
    expect(result.enough).toBe(true);
    expect(result.completedCycles).toBe(2);
    expect(result.coverage[0]).toBeGreaterThanOrEqual(0.6);
    expect(result.coverage[1]).toBeGreaterThanOrEqual(0.6);
  });
});
