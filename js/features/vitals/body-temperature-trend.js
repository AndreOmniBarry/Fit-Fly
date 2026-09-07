// Real insight from saved readings, not just a list — same shape as
// blood-pressure-trend.ts/spo2-trend.ts, applied to body temperature
// (°C) instead.
const DEFAULT_WINDOW_SIZE = 10;
export function summarizeBodyTemperatureTrend(samplesNewestFirst, windowSize = DEFAULT_WINDOW_SIZE) {
    if (samplesNewestFirst.length === 0)
        return null;
    const window = samplesNewestFirst.slice(0, windowSize);
    const values = window.map((s) => s.temperatureCelsius);
    const first = window[0];
    if (!first)
        return null;
    const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    return {
        latest: first.temperatureCelsius,
        average,
        min: Math.min(...values),
        max: Math.max(...values),
        deltaFromPrevious: window.length >= 2 ? Math.round((first.temperatureCelsius - (window[1]?.temperatureCelsius ?? first.temperatureCelsius)) * 10) / 10 : null,
        sampleCount: window.length,
        sparklineOldestFirst: [...values].reverse(),
    };
}
//# sourceMappingURL=body-temperature-trend.js.map