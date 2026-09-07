// Real insight from saved readings, not just a list — same principle as
// js/features/heart-rate/trend.js. Pure and deterministic: caller
// supplies the samples (newest first, same order
// listRecentBloodPressureSamples already returns) and how many recent
// ones count as "recent."
const DEFAULT_WINDOW_SIZE = 10;
export function summarizeBloodPressureTrend(samplesNewestFirst, windowSize = DEFAULT_WINDOW_SIZE) {
    if (samplesNewestFirst.length === 0)
        return null;
    const window = samplesNewestFirst.slice(0, windowSize);
    const systolics = window.map((s) => s.systolic);
    const diastolics = window.map((s) => s.diastolic);
    const avg = (values) => Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const first = window[0];
    if (!first)
        return null;
    return {
        latestSystolic: first.systolic,
        latestDiastolic: first.diastolic,
        avgSystolic: avg(systolics),
        avgDiastolic: avg(diastolics),
        minSystolic: Math.min(...systolics),
        maxSystolic: Math.max(...systolics),
        minDiastolic: Math.min(...diastolics),
        maxDiastolic: Math.max(...diastolics),
        deltaSystolicFromPrevious: window.length >= 2 ? first.systolic - (window[1]?.systolic ?? first.systolic) : null,
        deltaDiastolicFromPrevious: window.length >= 2 ? first.diastolic - (window[1]?.diastolic ?? first.diastolic) : null,
        sampleCount: window.length,
        systolicSparklineOldestFirst: [...systolics].reverse(),
        diastolicSparklineOldestFirst: [...diastolics].reverse(),
    };
}
/** Averages same-day readings into one real daily systolic/diastolic pair
 *  — several readings in a day shouldn't multiply-count in a day's trend
 *  point, the same "group before bucketing" principle as Hydration's own
 *  groupHydrationByDate. The basis for a real D/W/M/6M/Y trend (see
 *  js/lib/time-range.js) instead of a fixed "last N readings" sparkline. */
export function groupBloodPressureByDate(samples) {
    const totals = new Map();
    for (const sample of samples) {
        const date = sample.recordedAt.slice(0, 10);
        const bucket = totals.get(date) ?? { sysSum: 0, diaSum: 0, count: 0 };
        bucket.sysSum += sample.systolic;
        bucket.diaSum += sample.diastolic;
        bucket.count += 1;
        totals.set(date, bucket);
    }
    const averages = new Map();
    for (const [date, { sysSum, diaSum, count }] of totals) {
        averages.set(date, { avgSystolic: sysSum / count, avgDiastolic: diaSum / count });
    }
    return averages;
}
//# sourceMappingURL=blood-pressure-trend.js.map