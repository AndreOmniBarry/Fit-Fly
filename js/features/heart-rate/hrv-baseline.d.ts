// Sidecar types for hrv-baseline.js (hand-written JS, untouched — see
// tsconfig.json). Personal-baseline HRV deviation from real BLE-derived
// RMSSD readings — see hrv-baseline.js's own doc comment for the real
// citations behind "compare to your own baseline, not a population norm."
export interface DailyHrvReading {
  date: string;
  rmssdMs: number;
}

export type HrvDeviationCategory = 'below-baseline' | 'at-baseline' | 'above-baseline';

export interface HrvBaselineDeviation {
  latestDate: string | null;
  latestRmssdMs: number | null;
  baselineRmssdMs: number | null;
  deviationMs: number | null;
  deviationPercent: number | null;
  category: HrvDeviationCategory | null;
  readingsInBaseline: number;
}

export const HRV_LARGE_DEVIATION_PERCENT: number;

export function dailyHrvFromSamples(samples: { recordedAt: string; rmssdMs?: number | null }[]): DailyHrvReading[];

export function calculateHrvBaselineDeviation(dailyReadings: DailyHrvReading[], asOfDate: string): HrvBaselineDeviation;
