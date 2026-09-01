import { describe, expect, it } from 'vitest';
import { computeSplits } from '../../../js/features/run/splits.js';

// A straight line north — 1 degree of latitude is ~111,195m, so short
// steps of known fractional-degree size give predictable distances
// without needing real GPS fixtures.
function straightLinePoints(count, degreeStep, msPerPoint) {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({ lat: i * degreeStep, lon: 0, tMs: i * msPerPoint });
  }
  return points;
}

describe('computeSplits', () => {
  it('is empty for fewer than 2 points or a non-positive split size', () => {
    expect(computeSplits([], 1000)).toEqual([]);
    expect(computeSplits([{ lat: 0, lon: 0, tMs: 0 }], 1000)).toEqual([]);
    const points = straightLinePoints(5, 0.01, 1000);
    expect(computeSplits(points, 0)).toEqual([]);
  });

  it('records one split per full boundary crossed, in order', () => {
    // ~111.2m per 0.001 degree step; 10 steps of 0.001deg ≈ 1112m, enough
    // to cross exactly one 1000m boundary.
    const points = straightLinePoints(11, 0.001, 1000);
    const splits = computeSplits(points, 1000);
    expect(splits).toHaveLength(1);
    expect(splits[0].splitNumber).toBe(1);
    expect(splits[0].distanceMeters).toBe(1000);
    expect(splits[0].durationMs).toBeGreaterThan(0);
  });

  it('records multiple splits for a longer route, each covering the same fixed distance', () => {
    // ~111,195m total over 100 steps of 0.01deg — crosses several 1km
    // boundaries.
    const points = straightLinePoints(101, 0.01, 1000);
    const splits = computeSplits(points, 1000);
    expect(splits.length).toBeGreaterThanOrEqual(3);
    splits.forEach((split, i) => {
      expect(split.splitNumber).toBe(i + 1);
      expect(split.distanceMeters).toBe(1000);
    });
  });

  it('a slower second half produces a slower second split', () => {
    // First 1000m covered quickly (small time steps), second 1000m
    // covered slowly (large time steps) — the split durations should
    // reflect that, not average it away.
    const fastLeg = straightLinePoints(11, 0.001, 200); // ~1112m in 2000ms
    const slowLegStart = fastLeg[fastLeg.length - 1];
    const slowLeg = [];
    for (let i = 1; i <= 10; i++) {
      slowLeg.push({
        lat: slowLegStart.lat + i * 0.001,
        lon: 0,
        tMs: slowLegStart.tMs + i * 2000, // 10x slower per step
      });
    }
    const points = [...fastLeg, ...slowLeg];
    const splits = computeSplits(points, 1000);
    expect(splits.length).toBeGreaterThanOrEqual(2);
    expect(splits[1].durationMs).toBeGreaterThan(splits[0].durationMs);
  });
});
