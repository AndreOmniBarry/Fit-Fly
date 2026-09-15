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
import { buildSmoothAreaGeometry } from '../../lib/smooth-chart.js';
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
/** Lays out a series of real values (bucketed nightly durations, in order)
 *  into an SVG-ready smooth line/area, scaled to fill `width`x`height`
 *  exactly. Never fabricates a point for a bucket that doesn't exist —
 *  pass exactly the buckets that are real. A thin wrapper around the
 *  shared js/lib/smooth-chart.ts geometry (same math, Sleep-specific
 *  naming/type kept for every existing caller). */
export function buildSleepInsightAreaGeometry(values, options = {}) {
    return buildSmoothAreaGeometry(values, options);
}
//# sourceMappingURL=sleep-insight-chart.js.map