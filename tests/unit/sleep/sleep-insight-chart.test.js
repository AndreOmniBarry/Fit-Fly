import { describe, expect, it } from 'vitest';
import {
  bucketSleepInsightNights,
  buildSleepInsightAreaGeometry,
} from '../../../js/features/sleep/sleep-insight-chart.js';

function night(date, durationMinutes, score, quality = null) {
  return { date, durationMinutes, score, quality };
}

describe('bucketSleepInsightNights: day bucket (pass-through)', () => {
  it('is empty for no nights', () => {
    expect(bucketSleepInsightNights([], 'day')).toEqual([]);
  });

  it('carries each real night through with its own exact values, sorted by date', () => {
    const nights = [night('2026-03-16', 420, 70, 4), night('2026-03-15', 480, 90, 5)];
    const buckets = bucketSleepInsightNights(nights, 'day');
    expect(buckets).toEqual([
      { key: '2026-03-15', durationMinutes: 480, score: 90, quality: 5, category: 'great', nightsLogged: 1 },
      { key: '2026-03-16', durationMinutes: 420, score: 70, quality: 4, category: 'good', nightsLogged: 1 },
    ]);
  });

  it('a night with no quality rating carries a null quality, never a fabricated one', () => {
    const buckets = bucketSleepInsightNights([night('2026-03-15', 480, 90, null)], 'day');
    expect(buckets[0].quality).toBeNull();
  });

  it('derives category from the score using the same bands calculateSleepScore uses', () => {
    const buckets = bucketSleepInsightNights(
      [
        night('2026-01-01', 480, 30),
        night('2026-01-02', 480, 55),
        night('2026-01-03', 480, 75),
        night('2026-01-04', 480, 95),
      ],
      'day'
    );
    expect(buckets.map((b) => b.category)).toEqual(['poor', 'fair', 'good', 'great']);
  });
});

describe('bucketSleepInsightNights: week/month bucketing', () => {
  it('averages duration and score across real nights sharing a week bucket', () => {
    // Both fall in the same Sun-Sat week as 2026-03-15 (a Sunday).
    const nights = [night('2026-03-15', 400, 60), night('2026-03-17', 480, 80)];
    const buckets = bucketSleepInsightNights(nights, 'week');
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ durationMinutes: 440, score: 70, nightsLogged: 2 });
  });

  it('averages self-rated quality only across the nights that were actually rated', () => {
    const nights = [night('2026-03-15', 400, 60, 3), night('2026-03-16', 480, 80, null)];
    const buckets = bucketSleepInsightNights(nights, 'week');
    expect(buckets[0].quality).toBe(3); // averaged over the one real rating, not diluted by the unrated night
  });

  it('a bucket with no rated nights at all has a null quality', () => {
    const nights = [night('2026-03-15', 400, 60, null), night('2026-03-16', 480, 80, null)];
    const buckets = bucketSleepInsightNights(nights, 'week');
    expect(buckets[0].quality).toBeNull();
  });

  it('averages across a month bucket the same way', () => {
    const nights = [night('2026-03-01', 400, 50), night('2026-03-20', 500, 90), night('2026-04-01', 600, 100)];
    const buckets = bucketSleepInsightNights(nights, 'month');
    expect(buckets).toEqual([
      { key: '2026-03', durationMinutes: 450, score: 70, quality: null, category: 'good', nightsLogged: 2 },
      { key: '2026-04', durationMinutes: 600, score: 100, quality: null, category: 'great', nightsLogged: 1 },
    ]);
  });
});

describe('buildSleepInsightAreaGeometry', () => {
  it('is empty for no values, never a fabricated flat line', () => {
    const geometry = buildSleepInsightAreaGeometry([]);
    expect(geometry.points).toEqual([]);
    expect(geometry.linePath).toBe('');
    expect(geometry.areaPath).toBe('');
  });

  it('places a single value dead center with an empty area (nothing to fill between)', () => {
    const geometry = buildSleepInsightAreaGeometry([480], { width: 320, height: 140 });
    expect(geometry.points).toEqual([{ x: 160, y: 0 }]); // the lone value is also the max, so y sits at the top
    expect(geometry.areaPath).toBe('');
  });

  it('spaces points evenly left to right across the full width', () => {
    const geometry = buildSleepInsightAreaGeometry([100, 200, 300, 400], { width: 300, height: 100 });
    expect(geometry.points.map((p) => p.x)).toEqual([0, 100, 200, 300]);
  });

  it('scales y so the highest value sits at the top (y=0) and the rest sit below it', () => {
    const geometry = buildSleepInsightAreaGeometry([200, 400], { width: 100, height: 100 });
    expect(geometry.points[1].y).toBe(0); // 400 is the max -> top
    expect(geometry.points[0].y).toBe(50); // 200 is half the max -> halfway down
  });

  it('the line path starts with a real "move to" the first point and visits every point', () => {
    const geometry = buildSleepInsightAreaGeometry([300, 480, 420], { width: 200, height: 100 });
    expect(geometry.linePath.startsWith('M0,')).toBe(true);
    // 2 segments between 3 points -> 2 cubic-bezier "C" commands.
    expect(geometry.linePath.match(/C/g)).toHaveLength(2);
  });

  it('the area path closes down to the chart floor and back to the first point', () => {
    const geometry = buildSleepInsightAreaGeometry([300, 480], { width: 200, height: 120 });
    expect(geometry.areaPath.endsWith('L200,120 L0,120 Z')).toBe(true);
  });

  it('never divides by zero when every value is 0', () => {
    const geometry = buildSleepInsightAreaGeometry([0, 0, 0], { width: 100, height: 50 });
    expect(geometry.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});
