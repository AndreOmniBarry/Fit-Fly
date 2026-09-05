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
/** Groups already-scored nights into the requested bucket size, honestly —
 *  delegates the actual grouping/averaging to js/lib/time-range.js's own
 *  bucketDailyPoints (once per metric) rather than re-implementing the
 *  "average only real logged days, never sum, never fabricate a missing
 *  day as zero" rule a second time. Input order doesn't matter; output is
 *  sorted by bucket key (bucketDailyPoints' own contract). */
export function bucketSleepInsightNights(nights, bucket) {
    const durationBuckets = bucketDailyPoints(nights.map((n) => ({ date: n.date, value: n.durationMinutes })), bucket);
    const scoreByKey = new Map(bucketDailyPoints(nights.map((n) => ({ date: n.date, value: n.score })), bucket).map((b) => [b.key, b.value]));
    const ratedNights = nights.filter((n) => n.quality != null);
    const qualityByKey = new Map(bucketDailyPoints(ratedNights.map((n) => ({ date: n.date, value: n.quality })), bucket).map((b) => [b.key, b.value]));
    return durationBuckets.map((durationBucket) => {
        const score = Math.round(scoreByKey.get(durationBucket.key) ?? 0);
        const quality = qualityByKey.has(durationBucket.key)
            ? Math.round(qualityByKey.get(durationBucket.key) * 10) / 10
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
function smoothPathThrough(points) {
    if (points.length === 0)
        return '';
    const first = points[0];
    if (points.length === 1)
        return `M${first.x},${first.y}`;
    let d = `M${first.x},${first.y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        // Standard Catmull-Rom -> cubic Bezier control points (tension 1/6) —
        // the curve passes through every real p1/p2, only the tangent between
        // them is smoothed.
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
}
/** Lays out a series of real values (bucketed nightly durations, in order)
 *  into an SVG-ready smooth line/area, scaled to fill `width`x`height`
 *  exactly. Never fabricates a point for a bucket that doesn't exist —
 *  pass exactly the buckets that are real. */
export function buildSleepInsightAreaGeometry(values, { width = 320, height = 140 } = {}) {
    if (values.length === 0) {
        return { width, height, points: [], linePath: '', areaPath: '', maxValue: 0 };
    }
    const maxValue = Math.max(...values, 1);
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const points = values.map((value, i) => ({
        x: values.length > 1 ? i * stepX : width / 2,
        y: height - (value / maxValue) * height,
    }));
    const linePath = smoothPathThrough(points);
    const last = points[points.length - 1];
    const areaPath = points.length > 1 ? `${linePath} L${last.x},${height} L${points[0].x},${height} Z` : '';
    return { width, height, points, linePath, areaPath, maxValue };
}
//# sourceMappingURL=sleep-insight-chart.js.map