// Sidecar types for personal-records.js (hand-written JS, untouched — see
// tsconfig.json).
export interface RunPrInput {
  distanceMeters: number;
  avgPaceSecPerKm?: number | null;
}

export function longestRun<T extends RunPrInput>(runs: T[]): T | null;
export function fastestPaceRun<T extends RunPrInput>(runs: T[]): T | null;
export function detectNewPRs(
  newRun: RunPrInput,
  priorRuns: RunPrInput[]
): { isDistancePR: boolean; isPacePR: boolean };
