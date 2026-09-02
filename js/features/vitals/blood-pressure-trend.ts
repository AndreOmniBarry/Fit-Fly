// Real insight from saved readings, not just a list — same principle as
// js/features/heart-rate/trend.js. Pure and deterministic: caller
// supplies the samples (newest first, same order
// listRecentBloodPressureSamples already returns) and how many recent
// ones count as "recent."

const DEFAULT_WINDOW_SIZE = 10;

export interface BloodPressureSampleLike {
  systolic: number;
  diastolic: number;
}

export interface BloodPressureTrend {
  latestSystolic: number;
  latestDiastolic: number;
  avgSystolic: number;
  avgDiastolic: number;
  minSystolic: number;
  maxSystolic: number;
  minDiastolic: number;
  maxDiastolic: number;
  // null with only one reading — nothing to compare it to yet, never a
  // fake "+0" that implies a second data point exists.
  deltaSystolicFromPrevious: number | null;
  deltaDiastolicFromPrevious: number | null;
  sampleCount: number;
  systolicSparklineOldestFirst: number[];
  diastolicSparklineOldestFirst: number[];
}

export function summarizeBloodPressureTrend(
  samplesNewestFirst: BloodPressureSampleLike[],
  windowSize = DEFAULT_WINDOW_SIZE
): BloodPressureTrend | null {
  if (samplesNewestFirst.length === 0) return null;

  const window = samplesNewestFirst.slice(0, windowSize);
  const systolics = window.map((s) => s.systolic);
  const diastolics = window.map((s) => s.diastolic);
  const avg = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const first = window[0];
  if (!first) return null;

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
