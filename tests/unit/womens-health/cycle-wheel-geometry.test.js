import { describe, expect, it } from 'vitest';
import {
  buildCycleWheelSegments,
  donutSegmentPath,
  markerPosition,
  polarPoint,
} from '../../../js/features/womens-health/cycle-wheel-geometry.js';

const CENTER = { cx: 80, cy: 80 };
const GEOMETRY = { center: CENTER, outerRadius: 70, innerRadius: 46 };

describe('polarPoint', () => {
  it('fraction 0 lands at the very top (12 o\'clock)', () => {
    const p = polarPoint(CENTER, 70, 0);
    expect(p.x).toBeCloseTo(80);
    expect(p.y).toBeCloseTo(10);
  });

  it('fraction 0.25 lands on the right (3 o\'clock) — clockwise, not counter-clockwise', () => {
    const p = polarPoint(CENTER, 70, 0.25);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(80);
  });

  it('fraction 0.5 lands at the bottom (6 o\'clock)', () => {
    const p = polarPoint(CENTER, 70, 0.5);
    expect(p.x).toBeCloseTo(80);
    expect(p.y).toBeCloseTo(150);
  });

  it('fraction 0.75 lands on the left (9 o\'clock)', () => {
    const p = polarPoint(CENTER, 70, 0.75);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(80);
  });

  it('fraction 1 wraps back to the same point as fraction 0', () => {
    const zero = polarPoint(CENTER, 70, 0);
    const full = polarPoint(CENTER, 70, 1);
    expect(full.x).toBeCloseTo(zero.x);
    expect(full.y).toBeCloseTo(zero.y);
  });
});

describe('donutSegmentPath', () => {
  it('produces a path string starting with a moveto and ending with a close', () => {
    const d = donutSegmentPath(CENTER, 70, 46, 0, 0.25);
    expect(d.startsWith('M')).toBe(true);
    expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('uses the large-arc-flag only once the span exceeds half the circle', () => {
    const small = donutSegmentPath(CENTER, 70, 46, 0, 0.2);
    const large = donutSegmentPath(CENTER, 70, 46, 0, 0.6);
    expect(small).toMatch(/A70,70 0 0 1/);
    expect(large).toMatch(/A70,70 0 1 1/);
  });

  it('splits a full-circle span (>=1) into two half-sweeps instead of one broken arc', () => {
    const d = donutSegmentPath(CENTER, 70, 46, 0, 1);
    // Two full wedges means two moveto commands, not one.
    expect(d.match(/M/g)?.length).toBe(2);
  });
});

describe('buildCycleWheelSegments', () => {
  const orderedSegments = [
    ['menstrual', 5],
    ['follicular', 7],
    ['ovulation', 2],
    ['luteal', 14],
  ];

  it('returns one entry per real, non-zero-day phase, in order', () => {
    const result = buildCycleWheelSegments(orderedSegments, GEOMETRY);
    expect(result.map((s) => s.phase)).toEqual(['menstrual', 'follicular', 'ovulation', 'luteal']);
  });

  it('partitions fractions proportionally to each phase\'s real day count, not equal quarters', () => {
    const result = buildCycleWheelSegments(orderedSegments, GEOMETRY);
    const totalDays = 5 + 7 + 2 + 14;
    expect(result[0].startFraction).toBeCloseTo(0);
    expect(result[0].endFraction).toBeCloseTo(5 / totalDays);
    expect(result[1].startFraction).toBeCloseTo(5 / totalDays);
    expect(result[3].endFraction).toBeCloseTo(1);
  });

  it('skips phases with zero real days rather than drawing an empty wedge', () => {
    const withGap = [
      ['menstrual', 5],
      ['follicular', 0],
      ['ovulation', 2],
      ['luteal', 14],
    ];
    const result = buildCycleWheelSegments(withGap, GEOMETRY);
    expect(result.map((s) => s.phase)).toEqual(['menstrual', 'ovulation', 'luteal']);
  });

  it('returns an empty array when there are no real logged days at all', () => {
    const result = buildCycleWheelSegments(
      [
        ['menstrual', 0],
        ['follicular', 0],
      ],
      GEOMETRY,
    );
    expect(result).toEqual([]);
  });

  it('every segment carries a non-empty drawable path', () => {
    const result = buildCycleWheelSegments(orderedSegments, GEOMETRY);
    for (const segment of result) {
      expect(segment.d.length).toBeGreaterThan(0);
    }
  });
});

describe('markerPosition', () => {
  it('day 1 sits at the very top of the ring, same as fraction 0', () => {
    const pos = markerPosition(1, 28, GEOMETRY);
    expect(pos.fraction).toBeCloseTo(0);
    expect(pos.x).toBeCloseTo(80);
    expect(pos.y).toBeCloseTo(80 - (70 + 46) / 2);
  });

  it('sits at the ring\'s midline radius, not the inner or outer edge', () => {
    const pos = markerPosition(8, 28, GEOMETRY);
    const distanceFromCenter = Math.hypot(pos.x - CENTER.cx, pos.y - CENTER.cy);
    expect(distanceFromCenter).toBeCloseTo((70 + 46) / 2);
  });

  it('wraps around via modulo once the day count exceeds the cycle length', () => {
    const normal = markerPosition(8, 28, GEOMETRY);
    const wrapped = markerPosition(36, 28, GEOMETRY); // 36 - 1 = 35, 35/28 > 1
    expect(wrapped.fraction).toBeCloseTo(normal.fraction);
  });

  it('never divides by zero when cycleLengthDays is 0 — falls back to fraction 0', () => {
    const pos = markerPosition(1, 0, GEOMETRY);
    expect(pos.fraction).toBe(0);
  });
});
