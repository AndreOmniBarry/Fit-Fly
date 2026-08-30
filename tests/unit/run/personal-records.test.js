import { describe, expect, it } from 'vitest';
import { detectNewPRs, fastestPaceRun, longestRun } from '../../../js/features/run/personal-records.js';

const runs = [
  { id: 'r1', distanceMeters: 3000, avgPaceSecPerKm: 330 },
  { id: 'r2', distanceMeters: 5200, avgPaceSecPerKm: 300 },
  { id: 'r3', distanceMeters: 800, avgPaceSecPerKm: 250 }, // fast but too short for a pace PR
];

describe('longestRun', () => {
  it('picks the run with the greatest distance', () => {
    expect(longestRun(runs).id).toBe('r2');
  });

  it('returns null for an empty list', () => {
    expect(longestRun([])).toBeNull();
  });
});

describe('fastestPaceRun', () => {
  it('picks the lowest sec/km among runs at or above the minimum distance', () => {
    expect(fastestPaceRun(runs).id).toBe('r2');
  });

  it('ignores runs under the minimum distance even if their pace looks fast', () => {
    const onlyShort = [{ id: 'short', distanceMeters: 400, avgPaceSecPerKm: 200 }];
    expect(fastestPaceRun(onlyShort)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(fastestPaceRun([])).toBeNull();
  });
});

describe('detectNewPRs', () => {
  it('a run longer than every prior run is a distance PR', () => {
    const newRun = { distanceMeters: 6000, avgPaceSecPerKm: 310 };
    expect(detectNewPRs(newRun, runs).isDistancePR).toBe(true);
  });

  it('a run shorter than the current longest is not a distance PR', () => {
    const newRun = { distanceMeters: 2000, avgPaceSecPerKm: 310 };
    expect(detectNewPRs(newRun, runs).isDistancePR).toBe(false);
  });

  it('a run faster than the current fastest (and long enough) is a pace PR', () => {
    const newRun = { distanceMeters: 4000, avgPaceSecPerKm: 280 };
    expect(detectNewPRs(newRun, runs).isPacePR).toBe(true);
  });

  it('a run that is fast but too short is never a pace PR', () => {
    const newRun = { distanceMeters: 500, avgPaceSecPerKm: 200 };
    expect(detectNewPRs(newRun, runs).isPacePR).toBe(false);
  });

  it('the very first run of all time is both PRs at once (when long enough)', () => {
    const newRun = { distanceMeters: 5000, avgPaceSecPerKm: 320 };
    expect(detectNewPRs(newRun, [])).toEqual({ isDistancePR: true, isPacePR: true });
  });

  it('a short first-ever run is a distance PR but not a pace PR', () => {
    const newRun = { distanceMeters: 500, avgPaceSecPerKm: 320 };
    expect(detectNewPRs(newRun, [])).toEqual({ isDistancePR: true, isPacePR: false });
  });
});
