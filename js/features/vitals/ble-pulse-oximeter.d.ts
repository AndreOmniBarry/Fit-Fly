// Sidecar types for ble-pulse-oximeter.js (hand-written JS, untouched —
// see tsconfig.json).
export interface PulseOximeterReading {
  spo2: number | null;
  pulseRate: number | null;
}

export function isBluetoothAvailable(): boolean;

export function parsePulseOximeterMeasurement(dataView: DataView): PulseOximeterReading;

export function connectPulseOximeterMonitor(callbacks: {
  onReading?: (reading: PulseOximeterReading) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}): Promise<{ device: unknown; disconnect: () => void } | null>;
