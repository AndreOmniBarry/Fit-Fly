import { describe, expect, it } from 'vitest';
import {
  elevationGainMeters,
  elevationLossMeters,
  elevationRangeMeters,
  estimateFlightsClimbed,
  filterAccurateElevationPoints,
  hasElevationData,
} from '../../../js/features/run/gps-elevation.js';

function pt(altitudeM, altitudeAccuracyM = 5) {
  return { lat: 0, lon: 0, altitudeM, altitudeAccuracyM };
}

describe('filterAccurateElevationPoints', () => {
  it('drops points with no real altitude reading', () => {
    const points = [pt(10), { lat: 0, lon: 0, altitudeM: null, altitudeAccuracyM: 5 }, pt(12)];
    expect(filterAccurateElevationPoints(points)).toHaveLength(2);
  });

  it('drops points whose reported vertical accuracy is worse than the threshold', () => {
    const points = [pt(10, 5), pt(20, 50), pt(30, 10)];
    expect(filterAccurateElevationPoints(points, 20)).toHaveLength(2);
  });

  it('keeps a point with no accuracy field at all rather than guessing', () => {
    const points = [pt(10, 5), { lat: 0, lon: 0, altitudeM: 20, altitudeAccuracyM: null }];
    expect(filterAccurateElevationPoints(points)).toHaveLength(2);
  });
});

describe('hasElevationData', () => {
  it('is false with fewer than 2 accurate altitude readings', () => {
    expect(hasElevationData([])).toBe(false);
    expect(hasElevationData([pt(10)])).toBe(false);
    expect(hasElevationData([pt(10), { lat: 0, lon: 0, altitudeM: null, altitudeAccuracyM: null }])).toBe(false);
  });

  it('is true with 2 or more real accurate altitude readings', () => {
    expect(hasElevationData([pt(10), pt(15)])).toBe(true);
  });
});

describe('elevationGainMeters', () => {
  it('is 0 with a flat route', () => {
    expect(elevationGainMeters([pt(100), pt(100), pt(100)])).toBe(0);
  });

  it('sums real consecutive rises', () => {
    // 100 -> 105 (+5) -> 103 (descent, ignored) -> 110 (+7)
    expect(elevationGainMeters([pt(100), pt(105), pt(103), pt(110)])).toBe(12);
  });

  it('ignores jitter smaller than the noise floor', () => {
    // Each step rises only 0.4m — below the default 1m noise floor.
    expect(elevationGainMeters([pt(100), pt(100.4), pt(100.8)])).toBe(0);
  });

  it('a real steady climb above the noise floor counts in full', () => {
    expect(elevationGainMeters([pt(100), pt(102), pt(104), pt(106)])).toBe(6);
  });
});

describe('elevationLossMeters', () => {
  it('sums real consecutive descents, ignoring ascents', () => {
    // 100 -> 95 (-5) -> 98 (ascent, ignored) -> 90 (-8)
    expect(elevationLossMeters([pt(100), pt(95), pt(98), pt(90)])).toBe(13);
  });
});

describe('estimateFlightsClimbed', () => {
  it('floors partial flights — a partial flight is not a climbed one', () => {
    expect(estimateFlightsClimbed(8)).toBe(2); // 8/3 = 2.67
  });

  it('is 0 below one full flight (3m)', () => {
    expect(estimateFlightsClimbed(2.9)).toBe(0);
  });

  it('counts a real exact multiple cleanly', () => {
    expect(estimateFlightsClimbed(30)).toBe(10);
  });
});

describe('elevationRangeMeters', () => {
  it('is null with no usable altitude data', () => {
    expect(elevationRangeMeters([])).toBeNull();
  });

  it('reports the real min/max across accurate readings', () => {
    expect(elevationRangeMeters([pt(100), pt(120), pt(90)])).toEqual({ minM: 90, maxM: 120 });
  });
});
