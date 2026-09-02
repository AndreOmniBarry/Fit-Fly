import { describe, expect, it } from 'vitest';
import { summarizeBloodPressureTrend } from '../../../js/features/vitals/blood-pressure-trend.js';

describe('summarizeBloodPressureTrend', () => {
  it('is null with no readings at all', () => {
    expect(summarizeBloodPressureTrend([])).toBeNull();
  });

  it('a single reading has latest/avg/min/max equal to itself, and no delta to compare against', () => {
    const result = summarizeBloodPressureTrend([{ systolic: 120, diastolic: 80 }]);
    expect(result).toEqual({
      latestSystolic: 120,
      latestDiastolic: 80,
      avgSystolic: 120,
      avgDiastolic: 80,
      minSystolic: 120,
      maxSystolic: 120,
      minDiastolic: 80,
      maxDiastolic: 80,
      deltaSystolicFromPrevious: null,
      deltaDiastolicFromPrevious: null,
      sampleCount: 1,
      systolicSparklineOldestFirst: [120],
      diastolicSparklineOldestFirst: [80],
    });
  });

  it('computes real per-number average/min/max/delta across several readings, newest first', () => {
    const result = summarizeBloodPressureTrend([
      { systolic: 130, diastolic: 85 },
      { systolic: 120, diastolic: 80 },
      { systolic: 110, diastolic: 75 },
    ]);
    expect(result.latestSystolic).toBe(130);
    expect(result.latestDiastolic).toBe(85);
    expect(result.avgSystolic).toBe(120);
    expect(result.avgDiastolic).toBe(80);
    expect(result.minSystolic).toBe(110);
    expect(result.maxSystolic).toBe(130);
    expect(result.minDiastolic).toBe(75);
    expect(result.maxDiastolic).toBe(85);
    expect(result.deltaSystolicFromPrevious).toBe(10); // 130 - 120
    expect(result.deltaDiastolicFromPrevious).toBe(5); // 85 - 80
    expect(result.sampleCount).toBe(3);
    expect(result.systolicSparklineOldestFirst).toEqual([110, 120, 130]);
    expect(result.diastolicSparklineOldestFirst).toEqual([75, 80, 85]);
  });

  it('a lower latest reading than the previous one gives a negative delta', () => {
    const result = summarizeBloodPressureTrend([
      { systolic: 115, diastolic: 75 },
      { systolic: 140, diastolic: 90 },
    ]);
    expect(result.deltaSystolicFromPrevious).toBe(-25);
    expect(result.deltaDiastolicFromPrevious).toBe(-15);
  });

  it('only ever looks at the most recent windowSize readings, ignoring older ones', () => {
    const samples = [
      { systolic: 120, diastolic: 80 },
      { systolic: 118, diastolic: 78 },
      { systolic: 122, diastolic: 82 },
      { systolic: 200, diastolic: 150 }, // deliberately outside the window
    ];
    const result = summarizeBloodPressureTrend(samples, 3);
    expect(result.sampleCount).toBe(3);
    expect(result.maxSystolic).toBe(122);
    expect(result.avgSystolic).toBe(120); // (120+118+122)/3, not including 200
  });
});
