import { describe, expect, it } from 'vitest';
import { buildSmoothAreaGeometry, smoothPathThrough } from '../../../js/lib/smooth-chart.js';

describe('smoothPathThrough', () => {
  it('is empty for no points', () => {
    expect(smoothPathThrough([])).toBe('');
  });

  it('is a bare move-to for a single point', () => {
    expect(smoothPathThrough([{ x: 5, y: 5 }])).toBe('M5,5');
  });

  it('visits every point with a cubic-bezier segment between each pair', () => {
    const path = smoothPathThrough([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]);
    expect(path.startsWith('M0,0')).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
  });
});

describe('buildSmoothAreaGeometry', () => {
  it('is empty for no values, never a fabricated flat line', () => {
    const geometry = buildSmoothAreaGeometry([]);
    expect(geometry.points).toEqual([]);
    expect(geometry.linePath).toBe('');
    expect(geometry.areaPath).toBe('');
  });

  it('spaces points evenly left to right and scales y with the max at the top', () => {
    const geometry = buildSmoothAreaGeometry([200, 400], { width: 100, height: 100 });
    expect(geometry.points.map((p) => p.x)).toEqual([0, 100]);
    expect(geometry.points[1].y).toBe(0);
    expect(geometry.points[0].y).toBe(50);
  });

  it('a custom floorValue scales the range from that floor instead of zero', () => {
    // Without a floor, 500 (half of 1000) sits halfway down. With a floor
    // of 500 itself, the same 500 value sits at the very bottom — the
    // point of a real, non-zero floor (e.g. a hydration reference line).
    const noFloor = buildSmoothAreaGeometry([500, 1000], { width: 100, height: 100 });
    expect(noFloor.points[0].y).toBe(50);

    const withFloor = buildSmoothAreaGeometry([500, 1000], { width: 100, height: 100, floorValue: 500 });
    expect(withFloor.points[0].y).toBe(100);
    expect(withFloor.points[1].y).toBe(0);
  });

  it('never divides by zero when every value equals the floor', () => {
    const geometry = buildSmoothAreaGeometry([0, 0, 0], { width: 100, height: 50 });
    expect(geometry.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('closes the area path down to the chart floor and back to the first point', () => {
    const geometry = buildSmoothAreaGeometry([300, 480], { width: 200, height: 120 });
    expect(geometry.areaPath.endsWith('L200,120 L0,120 Z')).toBe(true);
  });
});
