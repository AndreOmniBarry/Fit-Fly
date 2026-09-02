// Sidecar types for ble-blood-pressure.js (hand-written JS, untouched —
// see tsconfig.json).
export interface BloodPressureReading {
  systolic: number | null;
  diastolic: number | null;
  meanArterialPressure: number | null;
  unit: 'mmHg' | 'kPa';
  pulseRate: number | null;
}

export function isBluetoothAvailable(): boolean;

export function parseBloodPressureMeasurement(dataView: DataView): BloodPressureReading;

export function connectBloodPressureMonitor(callbacks: {
  onReading?: (reading: BloodPressureReading) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}): Promise<{ device: unknown; disconnect: () => void } | null>;
