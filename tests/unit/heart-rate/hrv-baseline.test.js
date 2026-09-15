import { describe, expect, it } from 'vitest';
import {
  calculateHrvBaselineDeviation,
  dailyHrvFromSamples,
  HRV_LARGE_DEVIATION_PERCENT,
} from '../../../js/features/heart-rate/hrv-baseline.js';

function dateOffset(dateKey, deltaDays) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('dailyHrvFromSamples', () => {
  it('skips samples with no real rmssdMs (camera/manual entries, or a BLE reading with too few RR-intervals)', () => {
    const samples = [
      { recordedAt: '2026-03-01T08:00:00', rmssdMs: null },
      { recordedAt: '2026-03-01T09:00:00' }, // no field at all
    ];
    expect(dailyHrvFromSamples(samples)).toEqual([]);
  });

  it('averages, not sums, multiple real readings on the same real day — HRV is not a cumulative quantity', () => {
    const samples = [
      { recordedAt: '2026-03-01T08:00:00', rmssdMs: 40 },
      { recordedAt: '2026-03-01T20:00:00', rmssdMs: 60 },
    ];
    expect(dailyHrvFromSamples(samples)).toEqual([{ date: '2026-03-01', rmssdMs: 50 }]);
  });

  it('groups by local calendar date', () => {
    const samples = [
      { recordedAt: '2026-03-01T00:00:00', rmssdMs: 55 },
      { recordedAt: '2026-03-02T00:00:00', rmssdMs: 65 },
    ];
    expect(dailyHrvFromSamples(samples)).toEqual([
      { date: '2026-03-01', rmssdMs: 55 },
      { date: '2026-03-02', rmssdMs: 65 },
    ]);
  });
});

describe('calculateHrvBaselineDeviation: sparse-history honesty', () => {
  it('returns every field null (besides readingsInBaseline) with no history at all', () => {
    const result = calculateHrvBaselineDeviation([], '2026-03-28');
    expect(result).toEqual({
      latestDate: null,
      latestRmssdMs: null,
      baselineRmssdMs: null,
      deviationMs: null,
      deviationPercent: null,
      category: null,
      readingsInBaseline: 0,
    });
  });

  it('never fabricates a baseline from a single real reading', () => {
    const dailyReadings = [{ date: '2026-03-28', rmssdMs: 50 }];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.latestDate).toBe('2026-03-28');
    expect(result.latestRmssdMs).toBe(50);
    expect(result.baselineRmssdMs).toBeNull();
    expect(result.deviationPercent).toBeNull();
    expect(result.category).toBeNull();
    expect(result.readingsInBaseline).toBe(0);
  });

  it('never fabricates a baseline from only two prior readings — real floor is 3 (Plews et al.\'s own recommended weekly minimum)', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -2), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -1), rmssdMs: 52 },
      { date: '2026-03-28', rmssdMs: 40 },
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.readingsInBaseline).toBe(2);
    expect(result.baselineRmssdMs).toBeNull();
    expect(result.category).toBeNull();
  });

  it('exactly 3 real prior readings within the window is enough for a real baseline', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -3), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -1), rmssdMs: 50 },
      { date: '2026-03-28', rmssdMs: 50 },
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.readingsInBaseline).toBe(3);
    expect(result.baselineRmssdMs).toBe(50);
    expect(result.category).toBe('at-baseline');
  });
});

describe('calculateHrvBaselineDeviation: a clear below-baseline case', () => {
  it('flags a real, sustained drop below this person\'s own recent baseline', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -5), rmssdMs: 60 },
      { date: dateOffset('2026-03-28', -4), rmssdMs: 60 },
      { date: dateOffset('2026-03-28', -3), rmssdMs: 60 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 60 },
      { date: '2026-03-28', rmssdMs: 45 }, // 25% below the real 60ms baseline
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.baselineRmssdMs).toBe(60);
    expect(result.latestRmssdMs).toBe(45);
    expect(result.deviationPercent).toBeCloseTo(-25, 0);
    expect(result.category).toBe('below-baseline');
  });
});

describe('calculateHrvBaselineDeviation: at-baseline and above-baseline', () => {
  it('a latest reading close to baseline (within the notable band) reads as at-baseline', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -4), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -3), rmssdMs: 52 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 48 },
      { date: '2026-03-28', rmssdMs: 51 },
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.category).toBe('at-baseline');
  });

  it('a real, sustained rise above baseline reads as above-baseline', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -4), rmssdMs: 40 },
      { date: dateOffset('2026-03-28', -3), rmssdMs: 40 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 40 },
      { date: '2026-03-28', rmssdMs: 50 }, // 25% above baseline
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.deviationPercent).toBeCloseTo(25, 0);
    expect(result.category).toBe('above-baseline');
  });
});

describe('calculateHrvBaselineDeviation: real-history mechanics', () => {
  it('ignores a reading dated after asOfDate entirely, including as the "latest"', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -3), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -1), rmssdMs: 50 },
      { date: '2026-03-28', rmssdMs: 50 },
      { date: '2026-03-29', rmssdMs: 999 }, // tomorrow — must not count or become "latest"
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.latestDate).toBe('2026-03-28');
    expect(result.latestRmssdMs).toBe(50);
  });

  it('excludes a real reading older than the trailing 7-day window from the baseline', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -10), rmssdMs: 20 }, // outside the window — must not drag the baseline down
      { date: dateOffset('2026-03-28', -3), rmssdMs: 60 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 60 },
      { date: dateOffset('2026-03-28', -1), rmssdMs: 60 },
      { date: '2026-03-28', rmssdMs: 60 },
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.readingsInBaseline).toBe(3);
    expect(result.baselineRmssdMs).toBe(60);
    expect(result.category).toBe('at-baseline');
  });

  it('the latest reading never informs its own baseline', () => {
    const dailyReadings = [
      { date: dateOffset('2026-03-28', -3), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -2), rmssdMs: 50 },
      { date: dateOffset('2026-03-28', -1), rmssdMs: 50 },
      { date: '2026-03-28', rmssdMs: 1000 }, // an extreme "latest" value
    ];
    const result = calculateHrvBaselineDeviation(dailyReadings, '2026-03-28');
    expect(result.baselineRmssdMs).toBe(50); // unaffected by the extreme latest value
  });
});

describe('HRV_LARGE_DEVIATION_PERCENT', () => {
  it('is exported as a real positive number readiness.js can reuse for its own large-rise caveat', () => {
    expect(typeof HRV_LARGE_DEVIATION_PERCENT).toBe('number');
    expect(HRV_LARGE_DEVIATION_PERCENT).toBeGreaterThan(0);
  });
});
