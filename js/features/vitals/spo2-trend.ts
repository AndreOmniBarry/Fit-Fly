// Real insight from saved readings, not just a list — same shape as
// js/features/heart-rate/trend.js, applied to SpO2 % instead of bpm.

const DEFAULT_WINDOW_SIZE = 10;

export interface Spo2SampleLike {
  spo2: number;
}

export interface Spo2Trend {
  latest: number;
  average: number;
  min: number;
  max: number;
  deltaFromPrevious: number | null;
  sampleCount: number;
  sparklineOldestFirst: number[];
}

export function summarizeSpo2Trend(
  samplesNewestFirst: Spo2SampleLike[],
  windowSize = DEFAULT_WINDOW_SIZE
): Spo2Trend | null {
  if (samplesNewestFirst.length === 0) return null;

  const window = samplesNewestFirst.slice(0, windowSize);
  const values = window.map((s) => s.spo2);
  const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const first = window[0];
  if (!first) return null;

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

export interface Spo2DateGroupable {
  spo2: number;
  recordedAt: string;
}

/** Averages same-day readings into one real daily SpO2% — several
 *  readings in a day shouldn't multiply-count in a day's trend point,
 *  the same "group before bucketing" principle as Hydration's own
 *  groupHydrationByDate. The basis for a real D/W/M/6M/Y trend (see
 *  js/lib/time-range.js) instead of a fixed "last N readings" sparkline. */
export function groupSpo2ByDate(samples: Spo2DateGroupable[]): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const sample of samples) {
    const date = sample.recordedAt.slice(0, 10);
    const bucket = totals.get(date) ?? { sum: 0, count: 0 };
    bucket.sum += sample.spo2;
    bucket.count += 1;
    totals.set(date, bucket);
  }
  const averages = new Map<string, number>();
  for (const [date, { sum, count }] of totals) averages.set(date, sum / count);
  return averages;
}
