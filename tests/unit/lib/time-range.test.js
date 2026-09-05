import { describe, expect, it } from 'vitest';
import {
  bucketDailyPoints,
  formatBucketAxisLabel,
  formatBucketDetailLabel,
  timeRangeBounds,
  timeRangeDescription,
} from '../../../js/lib/time-range.js';

describe('timeRangeBounds', () => {
  it('D covers today only', () => {
    expect(timeRangeBounds('D', '2026-03-15')).toEqual({ start: '2026-03-15', end: '2026-03-15', bucket: 'day' });
  });

  it('W covers the last 7 days including today', () => {
    expect(timeRangeBounds('W', '2026-03-15')).toEqual({ start: '2026-03-09', end: '2026-03-15', bucket: 'day' });
  });

  it('M covers the last 30 days including today', () => {
    expect(timeRangeBounds('M', '2026-03-15')).toEqual({ start: '2026-02-14', end: '2026-03-15', bucket: 'day' });
  });

  it('6M covers the last 183 days, bucketed by week', () => {
    const bounds = timeRangeBounds('6M', '2026-03-15');
    expect(bounds.bucket).toBe('week');
    expect(bounds.end).toBe('2026-03-15');
    expect(bounds.start).toBe('2025-09-14');
  });

  it('Y covers the last 365 days, bucketed by month', () => {
    const bounds = timeRangeBounds('Y', '2026-03-15');
    expect(bounds.bucket).toBe('month');
    expect(bounds.end).toBe('2026-03-15');
    expect(bounds.start).toBe('2025-03-16');
  });

  it('correctly spans a year boundary', () => {
    expect(timeRangeBounds('W', '2026-01-02')).toEqual({ start: '2025-12-27', end: '2026-01-02', bucket: 'day' });
  });
});

describe('timeRangeDescription', () => {
  it('gives real, distinct copy for every range', () => {
    expect(timeRangeDescription('D')).toBe('Today only.');
    expect(timeRangeDescription('W')).toBe('Last 7 days.');
    expect(timeRangeDescription('M')).toBe('Last 30 days.');
    expect(timeRangeDescription('6M')).toBe('Last 6 months, grouped by week.');
    expect(timeRangeDescription('Y')).toBe('Last 12 months, grouped by month.');
  });
});

describe('bucketDailyPoints', () => {
  it('is a pass-through for the "day" bucket', () => {
    const points = [
      { date: '2026-03-14', value: 5000 },
      { date: '2026-03-15', value: 8000 },
    ];
    expect(bucketDailyPoints(points, 'day')).toEqual([
      { key: '2026-03-14', value: 5000, daysLogged: 1 },
      { key: '2026-03-15', value: 8000, daysLogged: 1 },
    ]);
  });

  it('sorts "day" bucket output chronologically regardless of input order — callers may not have sorted rows already (e.g. a table keyed by id, not date)', () => {
    const points = [
      { date: '2026-03-15', value: 8000 },
      { date: '2026-03-14', value: 5000 },
    ];
    expect(bucketDailyPoints(points, 'day')).toEqual([
      { key: '2026-03-14', value: 5000, daysLogged: 1 },
      { key: '2026-03-15', value: 8000, daysLogged: 1 },
    ]);
  });

  it('averages real logged days within a week bucket, never summing', () => {
    // 2026-03-15 is a Sunday — both dates fall in the same Sun-Sat week.
    const points = [
      { date: '2026-03-15', value: 6000 },
      { date: '2026-03-17', value: 10000 },
    ];
    const buckets = bucketDailyPoints(points, 'week');
    expect(buckets).toEqual([{ key: '2026-03-15', value: 8000, daysLogged: 2 }]);
  });

  it('averages real logged days within a month bucket', () => {
    const points = [
      { date: '2026-03-01', value: 4000 },
      { date: '2026-03-15', value: 8000 },
      { date: '2026-04-01', value: 20000 }, // different month, different bucket
    ];
    const buckets = bucketDailyPoints(points, 'month');
    expect(buckets).toEqual([
      { key: '2026-03', value: 6000, daysLogged: 2 },
      { key: '2026-04', value: 20000, daysLogged: 1 },
    ]);
  });

  it('never fabricates a zero for a day with no entry — an average is only ever over real logged days', () => {
    // A week bucket with just one real logged day still averages
    // honestly over that one day, not over 7 (which would silently
    // treat the six missing days as zero).
    const buckets = bucketDailyPoints([{ date: '2026-03-15', value: 9000 }], 'week');
    expect(buckets).toEqual([{ key: '2026-03-15', value: 9000, daysLogged: 1 }]);
  });

  it('is empty for no points, never a fabricated placeholder bucket', () => {
    expect(bucketDailyPoints([], 'week')).toEqual([]);
  });

  it('sorts buckets chronologically regardless of input order', () => {
    const points = [
      { date: '2026-04-01', value: 1 },
      { date: '2026-03-01', value: 2 },
    ];
    const buckets = bucketDailyPoints(points, 'month');
    expect(buckets.map((b) => b.key)).toEqual(['2026-03', '2026-04']);
  });
});

describe('formatBucketAxisLabel', () => {
  it('is a weekday initial for a day bucket', () => {
    expect(formatBucketAxisLabel('2026-03-15', 'day')).toBe('S'); // Sunday
  });

  it('is a short date for a week bucket', () => {
    expect(formatBucketAxisLabel('2026-03-15', 'week')).toBe('Mar 15');
  });

  it('is a month abbreviation for a month bucket', () => {
    expect(formatBucketAxisLabel('2026-03', 'month')).toBe('Mar');
  });
});

describe('formatBucketDetailLabel', () => {
  it('names the real weekday and date for a day bucket', () => {
    expect(formatBucketDetailLabel('2026-03-15', 'day')).toBe('Sun, Mar 15');
  });

  it('reads as a real span, not just its first day, for a week bucket', () => {
    expect(formatBucketDetailLabel('2026-03-15', 'week')).toBe('Week of Mar 15');
  });

  it('is the full month name and year for a month bucket', () => {
    expect(formatBucketDetailLabel('2026-03', 'month')).toBe('March 2026');
  });
});
