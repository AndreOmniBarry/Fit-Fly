// Real insight from a person's own repeated VO2max tests, over time —
// same shape as blood-pressure-trend.ts/spo2-trend.ts/body-temperature-
// trend.ts, applied here in place of the population-percentile
// classification this app deliberately doesn't ship (see
// vo2max-estimate.ts's own doc comment for why). Comparing this test to
// your own last one is honest in a way a borrowed norm table can't be
// when this app can't verify that table's exact numbers itself.

const DEFAULT_WINDOW_SIZE = 10;

export interface Vo2maxTestLike {
  vo2max: number;
}

export interface Vo2maxTrend {
  latest: number;
  average: number;
  min: number;
  max: number;
  // null with only one test — nothing to compare it to yet, never a
  // fake "+0" that implies a second data point exists.
  deltaFromPrevious: number | null;
  sampleCount: number;
  sparklineOldestFirst: number[];
}

export function summarizeVo2maxTrend(
  testsNewestFirst: Vo2maxTestLike[],
  windowSize = DEFAULT_WINDOW_SIZE
): Vo2maxTrend | null {
  if (testsNewestFirst.length === 0) return null;

  const window = testsNewestFirst.slice(0, windowSize);
  const values = window.map((t) => t.vo2max);
  const first = window[0];
  if (!first) return null;

  const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

  return {
    latest: first.vo2max,
    average,
    min: Math.min(...values),
    max: Math.max(...values),
    deltaFromPrevious:
      window.length >= 2 ? Math.round((first.vo2max - (window[1]?.vo2max ?? first.vo2max)) * 10) / 10 : null,
    sampleCount: window.length,
    sparklineOldestFirst: [...values].reverse(),
  };
}
