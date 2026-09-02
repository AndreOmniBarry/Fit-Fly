// Real insight from saved readings, not just a list — same shape as
// js/features/heart-rate/trend.js, applied to SpO2 % instead of bpm.
const DEFAULT_WINDOW_SIZE = 10;
export function summarizeSpo2Trend(samplesNewestFirst, windowSize = DEFAULT_WINDOW_SIZE) {
    if (samplesNewestFirst.length === 0)
        return null;
    const window = samplesNewestFirst.slice(0, windowSize);
    const values = window.map((s) => s.spo2);
    const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const first = window[0];
    if (!first)
        return null;
    return {
        latest: first.spo2,
        average,
        min: Math.min(...values),
        max: Math.max(...values),
        deltaFromPrevious: window.length >= 2 ? first.spo2 - (window[1]?.spo2 ?? first.spo2) : null,
        sampleCount: window.length,
        sparklineOldestFirst: [...values].reverse(),
    };
}
//# sourceMappingURL=spo2-trend.js.map