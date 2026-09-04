// Sidecar types for spo2.js (hand-written JS, untouched — see
// tsconfig.json).
export const SPO2_SOURCE: Readonly<{ MANUAL: 'manual'; BLE: 'ble' }>;

export interface Spo2SampleEntry {
  id: number;
  spo2: number;
  pulseRate: number | null;
  source: 'manual' | 'ble';
  recordedAt: string;
}

export function recordSpo2Sample(input: {
  spo2: number;
  pulseRate?: number | null;
  source: 'manual' | 'ble';
}): Promise<Spo2SampleEntry>;

export function listRecentSpo2Samples(limit?: number, db?: unknown): Promise<Spo2SampleEntry[]>;
