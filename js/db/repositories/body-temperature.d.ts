// Sidecar types for body-temperature.js (hand-written JS, untouched — see
// tsconfig.json).
export const BODY_TEMPERATURE_SOURCE: Readonly<{ MANUAL: 'manual'; BLE: 'ble' }>;

export interface BodyTemperatureSampleEntry {
  id: number;
  temperatureCelsius: number;
  source: 'manual' | 'ble';
  recordedAt: string;
}

export function recordBodyTemperatureSample(input: {
  temperatureCelsius: number;
  source: 'manual' | 'ble';
}): Promise<BodyTemperatureSampleEntry>;

export function listRecentBodyTemperatureSamples(limit?: number, db?: unknown): Promise<BodyTemperatureSampleEntry[]>;
