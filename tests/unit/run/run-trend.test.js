import { describe, expect, it } from 'vitest';
import { groupRunsByDate } from '../../../js/features/run/run-trend.js';

describe('groupRunsByDate', () => {
  it('sums multiple runs on the same day into one real daily distance total', () => {
    const runs = [
      { startedAt: '2026-03-15T08:00:00.000Z', distanceMeters: 3000 },
      { startedAt: '2026-03-15T18:30:00.000Z', distanceMeters: 2000 },
      { startedAt: '2026-03-14T08:00:00.000Z', distanceMeters: 5000 },
    ];
    const totals = groupRunsByDate(runs);
    expect(totals.get('2026-03-15')).toBe(5000);
    expect(totals.get('2026-03-14')).toBe(5000);
    expect(totals.size).toBe(2);
  });

  it('is empty with no runs', () => {
    expect(groupRunsByDate([]).size).toBe(0);
  });

  it('keeps a single run on its own day as that day\'s whole total', () => {
    const totals = groupRunsByDate([{ startedAt: '2026-01-01T12:00:00.000Z', distanceMeters: 10000 }]);
    expect(totals.get('2026-01-01')).toBe(10000);
    expect(totals.size).toBe(1);
  });
});
