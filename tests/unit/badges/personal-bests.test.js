import { describe, expect, it } from 'vitest';
import { computePersonalBests } from '../../../js/features/badges/personal-bests.js';

const EMPTY = { runs: [], stepEntries: [], hydrationEntries: [], distanceUnit: 'km' };

describe('computePersonalBests', () => {
  it('returns nothing at all with no real data anywhere — never a placeholder entry', () => {
    expect(computePersonalBests(EMPTY)).toEqual([]);
  });

  it('a real longest run shows the real distance, formatted in the real chosen unit', () => {
    const runs = [{ distanceMeters: 3000 }, { distanceMeters: 8500 }, { distanceMeters: 5000 }];
    const result = computePersonalBests({ ...EMPTY, runs });
    const longest = result.find((b) => b.id === 'pb-longest-run');
    expect(longest.value).toBe('8.50 km');
  });

  it('a real fastest pace shows the real pace, only from an eligible (1km+) run', () => {
    const runs = [
      { distanceMeters: 500, avgPaceSecPerKm: 200 }, // too short to count
      { distanceMeters: 5000, avgPaceSecPerKm: 300 },
      { distanceMeters: 5000, avgPaceSecPerKm: 280 },
    ];
    const result = computePersonalBests({ ...EMPTY, runs });
    const fastest = result.find((b) => b.id === 'pb-fastest-pace');
    expect(fastest.value).toContain('4:40'); // 280s/km == 4:40/km
  });

  it('no eligible run at all means no fastest-pace entry, not a fabricated one', () => {
    const runs = [{ distanceMeters: 500, avgPaceSecPerKm: 200 }];
    const result = computePersonalBests({ ...EMPTY, runs });
    expect(result.find((b) => b.id === 'pb-fastest-pace')).toBeUndefined();
    // The distance PR still counts — that run genuinely happened.
    expect(result.find((b) => b.id === 'pb-longest-run')).toBeDefined();
  });

  it('a real best steps day shows the real, comma-formatted count', () => {
    const stepEntries = [
      { date: '2026-01-01', steps: 4200 },
      { date: '2026-01-02', steps: 12500 },
    ];
    const result = computePersonalBests({ ...EMPTY, stepEntries });
    const bestDay = result.find((b) => b.id === 'pb-best-steps-day');
    expect(bestDay.value).toBe('12,500 steps');
  });

  it('a real best hydration day shows the real total in ml', () => {
    const hydrationEntries = [
      { date: '2026-01-01', amountMl: 1200 },
      { date: '2026-01-02', amountMl: 500 },
      { date: '2026-01-02', amountMl: 700 }, // same-day entries sum
    ];
    const result = computePersonalBests({ ...EMPTY, hydrationEntries });
    const bestDay = result.find((b) => b.id === 'pb-best-hydration-day');
    expect(bestDay.value).toBe('1,200ml');
  });

  it('every entry names a real category, never a blank or generic one', () => {
    const runs = [{ distanceMeters: 5000, avgPaceSecPerKm: 300 }];
    const stepEntries = [{ date: '2026-01-01', steps: 9000 }];
    const hydrationEntries = [{ date: '2026-01-01', amountMl: 2000 }];
    const result = computePersonalBests({ runs, stepEntries, hydrationEntries, distanceUnit: 'km' });
    for (const pb of result) {
      expect(pb.category.length).toBeGreaterThan(0);
      expect(pb.label.length).toBeGreaterThan(0);
      expect(pb.icon.length).toBeGreaterThan(0);
    }
  });

  it('respects the miles unit for distance and pace, the same way Run\'s own screens do', () => {
    const runs = [{ distanceMeters: 1609.344, avgPaceSecPerKm: 372.82 }]; // exactly 1 mile at a 10:00/mi pace
    const result = computePersonalBests({ ...EMPTY, runs, distanceUnit: 'mi' });
    expect(result.find((b) => b.id === 'pb-longest-run').value).toBe('1.00 mi');
    expect(result.find((b) => b.id === 'pb-fastest-pace').value).toContain('/mi');
  });
});
