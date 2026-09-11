// Sidecar types for vo2max-tests.js (hand-written JS, untouched — see
// tsconfig.json).
export interface Vo2maxCooperInputs {
  distanceMeters: number;
}

export interface Vo2maxRockportInputs {
  weightKg: number;
  ageYears: number;
  sex: 'male' | 'female';
  timeMinutes: number;
  heartRateBpm: number;
}

export interface Vo2maxTestEntry {
  id: number;
  vo2max: number;
  protocol: 'cooper' | 'rockport';
  inputs: Vo2maxCooperInputs | Vo2maxRockportInputs;
  recordedAt: string;
}

export function recordVo2maxTest(input: {
  vo2max: number;
  protocol: 'cooper' | 'rockport';
  inputs: Vo2maxCooperInputs | Vo2maxRockportInputs;
}): Promise<Vo2maxTestEntry>;

export function listRecentVo2maxTests(limit?: number, db?: unknown): Promise<Vo2maxTestEntry[]>;
