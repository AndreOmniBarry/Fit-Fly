import { describe, expect, it } from 'vitest';
import { sumActiveEnergy, isSameLocalDay, buildActiveEnergySegments } from '../../../js/features/activity/active-energy.js';

describe('sumActiveEnergy', () => {
  it('is null when every source is null — never a fabricated 0', () => {
    expect(sumActiveEnergy([null, null, null])).toBeNull();
  });

  it('is null for an empty list', () => {
    expect(sumActiveEnergy([])).toBeNull();
  });

  it('sums only the real, known contributions, ignoring null sources', () => {
    expect(sumActiveEnergy([120, null, 45, null])).toBe(165);
  });

  it('a single real source is returned as-is', () => {
    expect(sumActiveEnergy([200])).toBe(200);
  });

  it('rounds the total to a whole number', () => {
    expect(sumActiveEnergy([100.4, 50.4])).toBe(151);
  });
});

describe('isSameLocalDay', () => {
  const today = new Date(2026, 2, 15, 9, 0, 0); // local March 15, 2026, 9am

  it('is true for a timestamp earlier the same local day', () => {
    expect(isSameLocalDay(new Date(2026, 2, 15, 6, 0, 0).toISOString(), today)).toBe(true);
  });

  it('is false for yesterday', () => {
    expect(isSameLocalDay(new Date(2026, 2, 14, 23, 59, 0).toISOString(), today)).toBe(false);
  });

  it('is false for tomorrow', () => {
    expect(isSameLocalDay(new Date(2026, 2, 16, 0, 1, 0).toISOString(), today)).toBe(false);
  });
});

describe('buildActiveEnergySegments', () => {
  it('is empty with nothing real to show — never a fake full or empty ring', () => {
    expect(buildActiveEnergySegments([{ source: 'steps', kcal: null }, { source: 'run', kcal: null }])).toEqual([]);
  });

  it('drops sources that are null or zero, keeps only the real contributors', () => {
    const segments = buildActiveEnergySegments([
      { source: 'steps', kcal: 100 },
      { source: 'run', kcal: null },
      { source: 'activity', kcal: 0 },
    ]);
    expect(segments).toEqual([{ source: 'steps', kcal: 100, fraction: 1 }]);
  });

  it('splits fractions proportionally across real contributors, summing to 1', () => {
    const segments = buildActiveEnergySegments([
      { source: 'steps', kcal: 150 },
      { source: 'run', kcal: 50 },
    ]);
    expect(segments).toEqual([
      { source: 'steps', kcal: 150, fraction: 0.75 },
      { source: 'run', kcal: 50, fraction: 0.25 },
    ]);
    expect(segments.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1);
  });
});
