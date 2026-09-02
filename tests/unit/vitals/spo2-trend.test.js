import { describe, expect, it } from 'vitest';
import { summarizeSpo2Trend } from '../../../js/features/vitals/spo2-trend.js';

describe('summarizeSpo2Trend', () => {
  it('is null with no readings at all', () => {
    expect(summarizeSpo2Trend([])).toBeNull();
  });

  it('a single reading has a latest/average/min/max equal to itself, and no delta to compare against', () => {
    const result = summarizeSpo2Trend([{ spo2: 97 }]);
    expect(result).toEqual({
      latest: 97,
      average: 97,
      min: 97,
      max: 97,
      deltaFromPrevious: null,
      sampleCount: 1,
      sparklineOldestFirst: [97],
    });
  });

  it('computes a real average/min/max/delta across several readings, newest first', () => {
    const result = summarizeSpo2Trend([{ spo2: 99 }, { spo2: 97 }, { spo2: 95 }]);
    expect(result.latest).toBe(99);
    expect(result.average).toBe(97);
    expect(result.min).toBe(95);
    expect(result.max).toBe(99);
    expect(result.deltaFromPrevious).toBe(2); // 99 - 97
    expect(result.sampleCount).toBe(3);
    expect(result.sparklineOldestFirst).toEqual([95, 97, 99]);
  });

  it('a lower latest reading than the previous one gives a negative delta', () => {
    const result = summarizeSpo2Trend([{ spo2: 93 }, { spo2: 98 }]);
    expect(result.deltaFromPrevious).toBe(-5);
  });

  it('only ever looks at the most recent windowSize readings, ignoring older ones', () => {
    const samples = [{ spo2: 96 }, { spo2: 97 }, { spo2: 98 }, { spo2: 1 }]; // the 1 is deliberately outside the window
    const result = summarizeSpo2Trend(samples, 3);
    expect(result.sampleCount).toBe(3);
    expect(result.min).toBe(96);
    expect(result.average).toBe(97); // (96+97+98)/3, not including 1
  });
});
