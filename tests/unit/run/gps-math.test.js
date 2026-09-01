import { describe, expect, it } from 'vitest';
import {
  calculatePaceSecPerKm,
  filterAccuratePoints,
  formatDistance,
  formatPace,
  haversineDistanceMeters,
  recentPaceSecPerKm,
  totalRouteDistanceMeters,
} from '../../../js/features/run/gps-math.js';

describe('haversineDistanceMeters', () => {
  it('is zero for two identical points', () => {
    expect(haversineDistanceMeters({ lat: 40.7128, lon: -74.006 }, { lat: 40.7128, lon: -74.006 })).toBe(0);
  });

  it('matches the exact-radius calculation for a pure 1-degree latitude step', () => {
    // With dLon=0, haversine reduces exactly to R * dLat(radians).
    const expected = 6371000 * (Math.PI / 180);
    const actual = haversineDistanceMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(actual).toBeCloseTo(expected, 3);
  });

  it('is symmetric: A->B equals B->A', () => {
    const a = { lat: 51.5074, lon: -0.1278 };
    const b = { lat: 48.8566, lon: 2.3522 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 6);
  });
});

describe('totalRouteDistanceMeters', () => {
  it('is 0 for an empty or single-point route', () => {
    expect(totalRouteDistanceMeters([])).toBe(0);
    expect(totalRouteDistanceMeters([{ lat: 0, lon: 0 }])).toBe(0);
  });

  it('sums consecutive-point distances, not endpoint-to-endpoint', () => {
    // An out-and-back route: total distance should be double the leg,
    // not zero (which endpoint-to-endpoint would wrongly give).
    const start = { lat: 40, lon: -74 };
    const turnaround = { lat: 40.01, lon: -74 };
    const route = [start, turnaround, start];
    const leg = haversineDistanceMeters(start, turnaround);
    expect(totalRouteDistanceMeters(route)).toBeCloseTo(leg * 2, 3);
  });
});

describe('filterAccuratePoints', () => {
  it('drops fixes worse than the accuracy threshold', () => {
    const points = [
      { lat: 0, lon: 0, accuracyM: 5 },
      { lat: 0, lon: 0.001, accuracyM: 200 }, // a bad fix — should be dropped
      { lat: 0, lon: 0.002, accuracyM: 15 },
    ];
    const filtered = filterAccuratePoints(points, 30);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((p) => p.accuracyM <= 30)).toBe(true);
  });

  it('keeps a fix with no accuracy field rather than guessing', () => {
    const points = [{ lat: 0, lon: 0 }];
    expect(filterAccuratePoints(points)).toHaveLength(1);
  });
});

describe('calculatePaceSecPerKm', () => {
  it('5km in 25 minutes is 5:00/km (300 sec/km)', () => {
    expect(calculatePaceSecPerKm(5000, 25 * 60 * 1000)).toBe(300);
  });

  it('returns null for zero/negative distance or duration', () => {
    expect(calculatePaceSecPerKm(0, 60000)).toBeNull();
    expect(calculatePaceSecPerKm(1000, 0)).toBeNull();
    expect(calculatePaceSecPerKm(-5, 60000)).toBeNull();
  });
});

describe('formatPace', () => {
  it('formats seconds/km as M:SS /km', () => {
    expect(formatPace(300)).toBe('5:00 /km');
    expect(formatPace(325)).toBe('5:25 /km');
    expect(formatPace(65)).toBe('1:05 /km');
  });

  it('shows an em dash for null/non-finite input, never a NaN or Infinity', () => {
    expect(formatPace(null)).toBe('—');
    expect(formatPace(Infinity)).toBe('—');
    expect(formatPace(NaN)).toBe('—');
  });
});

describe('recentPaceSecPerKm', () => {
  it('is null with fewer than 2 points total', () => {
    expect(recentPaceSecPerKm([])).toBeNull();
    expect(recentPaceSecPerKm([{ lat: 0, lon: 0, tMs: 0 }])).toBeNull();
  });

  it('is null when fewer than 2 points fall inside the window', () => {
    const points = [
      { lat: 0, lon: 0, tMs: 0 },
      { lat: 0, lon: 0.02, tMs: 60000 }, // 60s ago — outside a 30s window
    ];
    expect(recentPaceSecPerKm(points, 30000)).toBeNull();
  });

  it('reflects only the recent window, not the whole route — a slow start then a fast recent burst reads as fast', () => {
    const points = [
      { lat: 0, lon: 0, tMs: 0 },
      { lat: 0, lon: 0.0001, tMs: 60000 }, // crawled for a minute (outside the window)
      { lat: 0, lon: 0.02, tMs: 65000 }, // then covered real ground in the last 5s
    ];
    const whole = calculatePaceSecPerKm(totalRouteDistanceMeters(points), 65000);
    const recent = recentPaceSecPerKm(points, 30000);
    expect(recent).not.toBeNull();
    expect(recent).toBeLessThan(whole); // faster (lower sec/km) than the whole-run average
  });
});

describe('formatDistance', () => {
  it('shows meters under 1km, km (2 decimals) at or above', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1000)).toBe('1.00 km');
    expect(formatDistance(5234)).toBe('5.23 km');
  });

  it('shows 0 m for zero/negative input', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(-5)).toBe('0 m');
  });
});
