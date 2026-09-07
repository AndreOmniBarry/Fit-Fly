// Sidecar types for ble-body-temperature.js (hand-written JS, untouched —
// see tsconfig.json).
export interface BodyTemperatureReading {
  temperatureCelsius: number | null;
}

export function isBluetoothAvailable(): boolean;

export function parseBodyTemperatureMeasurement(dataView: DataView): BodyTemperatureReading;

export function connectBodyTemperatureMonitor(callbacks: {
  onReading?: (reading: BodyTemperatureReading) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}): Promise<{ device: unknown; disconnect: () => void } | null>;
