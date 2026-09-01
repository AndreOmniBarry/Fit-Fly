import { describe, expect, it } from 'vitest';
import {
  formatDistanceForUnit,
  formatPaceForUnit,
  splitBoundaryMetersForUnit,
} from '../../../js/features/run/run-units.js';

// getDistanceUnit/setDistanceUnit wrap localStorage (js/lib/storage.js)
// the same way theme preference does — real persistence is covered by
// tests/e2e/run.spec.js's actual-browser round trip, same layering as
// the rest of this app's preferences (unit tests for the pure math,
// e2e for anything that touches storage).

describe('formatDistanceForUnit', () => {
  it('km unit delegates to the existing metric formatter unchanged', () => {
    expect(formatDistanceForUnit(1000, 'km')).toBe('1.00 km');
    expect(formatDistanceForUnit(850, 'km')).toBe('850 m');
  });

  it('mi unit converts meters to miles, 2 decimal places', () => {
    expect(formatDistanceForUnit(1609.344, 'mi')).toBe('1.00 mi');
    expect(formatDistanceForUnit(5000, 'mi')).toBe('3.11 mi');
  });

  it('shows 0 mi for zero/negative input', () => {
    expect(formatDistanceForUnit(0, 'mi')).toBe('0 mi');
    expect(formatDistanceForUnit(-5, 'mi')).toBe('0 mi');
  });
});

describe('formatPaceForUnit', () => {
  it('km unit delegates to the existing metric formatter unchanged', () => {
    expect(formatPaceForUnit(300, 'km')).toBe('5:00 /km');
  });

  it('mi unit converts sec/km to sec/mi (a mile is longer, so the pace number grows)', () => {
    // 5:00/km -> a mile takes longer to cover than a km, so /mi pace > /km pace
    const result = formatPaceForUnit(300, 'mi');
    expect(result).toBe('8:03 /mi');
  });

  it('shows an em dash for null/non-finite input in either unit', () => {
    expect(formatPaceForUnit(null, 'mi')).toBe('—');
    expect(formatPaceForUnit(Infinity, 'mi')).toBe('—');
  });
});

describe('splitBoundaryMetersForUnit', () => {
  it('is 1000 for km, one full mile in meters for mi', () => {
    expect(splitBoundaryMetersForUnit('km')).toBe(1000);
    expect(splitBoundaryMetersForUnit('mi')).toBeCloseTo(1609.344, 3);
  });
});
