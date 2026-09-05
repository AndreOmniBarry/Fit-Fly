// Pure bucketing + geometry for the Sleep Insights "Recent nights" chart —
// a smooth area of nightly duration, with each point/bucket colored by its
// own sleep score category (poor/fair/good/great, the exact banding
// calculateSleepScore already uses). One picture, two of Sleep's own real
// metrics: the shape reads "how long", the color reads "how it scored" —
// no fabricated third metric, and no invented data for a night that was
// never logged.
//
// Deliberately DOM-free (sleep-view.ts is the only thing that touches the
// document) so every number and path string here is directly assertable
// in a unit test, same "pure logic lives outside the view" convention as
// sleep-score.ts/sleep-consistency.ts/sleep-debt.ts/sleep-trends.ts.
import { bucketDailyPoints } from '../../lib/time-range.js';
import { categoryForScore } from './sleep-score.js';
import type { SleepCategory } from './types.js';

/** One already-scored night — the view computes `score` (calculateSleepScore
 *  run with whatever windowed context it has) before handing nights here;
 *  this module only reshapes and positions data it's given. */
export interface SleepInsightNight {
  date: string;
  durationMinutes: number;
  /** 0-100, already computed. */
  score: number;
  /** 1-5 self-rating, or null if that night wasn't rated. */
  quality: number | null;
}

export interface SleepInsightBucket {
  /** The bucket's own key — see time-range.ts's BucketedPoint.key. */
  key: string;
  /** Average duration across real logged nights in this bucket. */
  durationMinutes: number;
  /** Average score across real logged nights in this bucket, rounded. */
  score: number;
  /** Average self-rated quality across nights that had one, or null if
   *  none of this bucket's nights were rated — never a fabricated 0. */
  quality: number | null;
  category: SleepCategory;
  /** How many real logged nights this bucket is actually built from. */
  nightsLogged: number;
}

/** Groups already-scored nights into the requested bucket size, honestly —
 *  delegates the actual grouping/averaging to js/lib/time-range.js's own
 *  bucketDailyPoints (once per metric) rather than re-implementing the
 *  "average only real logged days, never sum, never fabricate a missing
 *  day as zero" rule a second time. Input order doesn't matter; output is
 *  sorted by bucket key (bucketDailyPoints' own contract). */
export function bucketSleepInsightNights(
  nights: SleepInsightNight[],
  bucket: 'day' | 'week' | 'month'
): SleepInsightBucket[] {
  const durationBuckets = bucketDailyPoints(
    nights.map((n) => ({ date: n.date, value: n.durationMinutes })),
    bucket
  );
  const scoreByKey = new Map(
    bucketDailyPoints(
      nights.map((n) => ({ date: n.date, value: n.score })),
      bucket
    ).map((b) => [b.key, b.value])
  );
  const ratedNights = nights.filter((n): n is SleepInsightNight & { quality: number } => n.quality != null);
  const qualityByKey = new Map(
    bucketDailyPoints(
      ratedNights.map((n) => ({ date: n.date, value: n.quality })),
      bucket
    ).map((b) => [b.key, b.value])
  );

  return durationBuckets.map((durationBucket) => {
    const score = Math.round(scoreByKey.get(durationBucket.key) ?? 0);
    const quality = qualityByKey.has(durationBucket.key)
      ? Math.round((qualityByKey.get(durationBucket.key) as number) * 10) / 10
      : null;

    return {
      key: durationBucket.key,
      durationMinutes: Math.round(durationBucket.value),
      score,
      quality,
      category: categoryForScore(score),
      nightsLogged: durationBucket.daysLogged,
    };
  });
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface SleepInsightChartGeometry {
  width: number;
  height: number;
  /** One point per bucket, in the same order — x is evenly spaced left to
   *  right, y is the duration scaled into [0, height] (0 at the top). */
  points: ChartPoint[];
  /** A smooth SVG path `d` string running through every point exactly
   *  (Catmull-Rom-to-Bezier — smooths the *curve* between real values,
   *  never approximates a value away). Empty when there's nothing to draw. */
  linePath: string;
  /** `linePath` closed down to the chart's bottom edge, for an area fill. */
  areaPath: string;
  maxValue: number;
}

function smoothPathThrough(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0] as ChartPoint;
  if (points.length === 1) return `M${first.x},${first.y}`;

  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i] as ChartPoint;
    const p2 = points[i + 1] as ChartPoint;
    const p3 = points[i + 2] ?? p2;
    // Standard Catmull-Rom -> cubic Bezier control points (tension 1/6) —
    // the curve passes through every real p1/p2, only the tangent between
    // them is smoothed.
    const cp1x = p1.x + (p2.x - (p0 as ChartPoint).x) / 6;
    const cp1y = p1.y + (p2.y - (p0 as ChartPoint).y) / 6;
    const cp2x = p2.x - ((p3 as ChartPoint).x - p1.x) / 6;
    const cp2y = p2.y - ((p3 as ChartPoint).y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Lays out a series of real values (bucketed nightly durations, in order)
 *  into an SVG-ready smooth line/area, scaled to fill `width`x`height`
 *  exactly. Never fabricates a point for a bucket that doesn't exist —
 *  pass exactly the buckets that are real. */
export function buildSleepInsightAreaGeometry(
  values: number[],
  { width = 320, height = 140 }: { width?: number; height?: number } = {}
): SleepInsightChartGeometry {
  if (values.length === 0) {
    return { width, height, points: [], linePath: '', areaPath: '', maxValue: 0 };
  }

  const maxValue = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const points: ChartPoint[] = values.map((value, i) => ({
    x: values.length > 1 ? i * stepX : width / 2,
    y: height - (value / maxValue) * height,
  }));

  const linePath = smoothPathThrough(points);
  const last = points[points.length - 1] as ChartPoint;
  const areaPath = points.length > 1 ? `${linePath} L${last.x},${height} L${(points[0] as ChartPoint).x},${height} Z` : '';

  return { width, height, points, linePath, areaPath, maxValue };
}
