import { describe, expect, it } from 'vitest';
import { summarizeBodyTemperatureTrend } from '../../../js/features/vitals/body-temperature-trend.js';

describe('summarizeBodyTemperatureTrend', () => {
  it('returns null for no samples', () => {
    expect(summarizeBodyTemperatureTrend([])).toBeNull();
  });

  it('summarizes a single reading with no delta (nothing prior to compare against)', () => {
    const trend = summarizeBodyTemperatureTrend([{ temperatureCelsius: 37.0 }]);
    expect(trend).toEqual({
      latest: 37.0,
      average: 37.0,
      min: 37.0,
      max: 37.0,
      deltaFromPrevious: null,
      sampleCount: 1,
      sparklineOldestFirst: [37.0],
    });
  });

  it('computes a real average, min/max, and delta across several readings (newest first)', () => {
    const trend = summarizeBodyTemperatureTrend([
      { temperatureCelsius: 38.0 },
      { temperatureCelsius: 37.5 },
      { temperatureCelsius: 36.8 },
    ]);
    expect(trend.latest).toBe(38.0);
    expect(trend.min).toBe(36.8);
    expect(trend.max).toBe(38.0);
    expect(trend.average).toBeCloseTo(37.4, 5); // (38.0+37.5+36.8)/3 = 37.4333.. rounded to 1dp
    expect(trend.deltaFromPrevious).toBeCloseTo(0.5, 5); // 38.0 - 37.5
    expect(trend.sampleCount).toBe(3);
    expect(trend.sparklineOldestFirst).toEqual([36.8, 37.5, 38.0]);
  });

  it('reports zero delta honestly when two consecutive readings match exactly', () => {
    const trend = summarizeBodyTemperatureTrend([{ temperatureCelsius: 37.0 }, { temperatureCelsius: 37.0 }]);
    expect(trend.deltaFromPrevious).toBe(0);
  });

  it('only considers the most recent windowSize readings', () => {
    const samples = Array.from({ length: 15 }, (_, i) => ({ temperatureCelsius: 36.5 + i * 0.1 }));
    const trend = summarizeBodyTemperatureTrend(samples, 5);
    expect(trend.sampleCount).toBe(5);
    expect(trend.sparklineOldestFirst).toHaveLength(5);
  });
});
