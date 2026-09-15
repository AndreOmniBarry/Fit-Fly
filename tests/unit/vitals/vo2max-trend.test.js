import { describe, expect, it } from 'vitest';
import { summarizeVo2maxTrend } from '../../../js/features/vitals/vo2max-trend.js';

describe('summarizeVo2maxTrend', () => {
  it('returns null for no tests', () => {
    expect(summarizeVo2maxTrend([])).toBeNull();
  });

  it('summarizes a single test with no delta (nothing prior to compare against)', () => {
    const trend = summarizeVo2maxTrend([{ vo2max: 42.5 }]);
    expect(trend).toEqual({
      latest: 42.5,
      average: 42.5,
      min: 42.5,
      max: 42.5,
      deltaFromPrevious: null,
      sampleCount: 1,
      sparklineOldestFirst: [42.5],
    });
  });

  it('computes a real average, min/max, and delta across several tests (newest first)', () => {
    const trend = summarizeVo2maxTrend([{ vo2max: 45.0 }, { vo2max: 43.0 }, { vo2max: 40.0 }]);
    expect(trend.latest).toBe(45.0);
    expect(trend.min).toBe(40.0);
    expect(trend.max).toBe(45.0);
    expect(trend.average).toBeCloseTo(42.7, 5);
    expect(trend.deltaFromPrevious).toBeCloseTo(2.0, 5);
    expect(trend.sampleCount).toBe(3);
    expect(trend.sparklineOldestFirst).toEqual([40.0, 43.0, 45.0]);
  });

  it('reports zero delta honestly when two consecutive tests match exactly', () => {
    const trend = summarizeVo2maxTrend([{ vo2max: 40.0 }, { vo2max: 40.0 }]);
    expect(trend.deltaFromPrevious).toBe(0);
  });

  it('only looks within the given window, ignoring older tests', () => {
    const tests = [{ vo2max: 50 }, { vo2max: 48 }, { vo2max: 20 }];
    const trend = summarizeVo2maxTrend(tests, 2);
    expect(trend.sampleCount).toBe(2);
    expect(trend.min).toBe(48);
  });
});
