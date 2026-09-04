// Sidecar types for blood-pressure.js (hand-written JS, untouched — see
// tsconfig.json).
export const BP_SOURCE: Readonly<{ MANUAL: 'manual'; BLE: 'ble' }>;

export interface BloodPressureSampleEntry {
  id: number;
  systolic: number;
  diastolic: number;
  pulseRate: number | null;
  source: 'manual' | 'ble';
  recordedAt: string;
}

export function recordBloodPressureSample(input: {
  systolic: number;
  diastolic: number;
  pulseRate?: number | null;
  source: 'manual' | 'ble';
}): Promise<BloodPressureSampleEntry>;

export function listRecentBloodPressureSamples(limit?: number, db?: unknown): Promise<BloodPressureSampleEntry[]>;
