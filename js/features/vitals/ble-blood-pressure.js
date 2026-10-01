// Real blood-pressure-cuff BLE support — same real native-BLE-inside-the-
// app, real-Web-Bluetooth-in-a-browser-tab transport as ble-heart-rate.js,
// through the shared js/lib/bluetooth.js connectBleCharacteristic().
import { connectBleCharacteristic, isBluetoothAvailable, sig16BitUuid } from '../../lib/bluetooth.js';
import { parseSFloat } from '../../lib/ieee11073.js';

export { isBluetoothAvailable };

// Bluetooth SIG assigned numbers: Blood Pressure service 0x1810, Blood
// Pressure Measurement characteristic 0x2A35.
const BLOOD_PRESSURE_SERVICE = sig16BitUuid('1810');
const BLOOD_PRESSURE_MEASUREMENT_CHARACTERISTIC = sig16BitUuid('2a35');

const FLAG_KPA_UNITS = 0x1;
const FLAG_TIMESTAMP_PRESENT = 0x2;
const FLAG_PULSE_RATE_PRESENT = 0x4;

/** Parses the standard Bluetooth SIG Blood Pressure Measurement
 *  characteristic: a flags byte, then three IEEE-11073 SFLOATs
 *  (systolic, diastolic, mean arterial pressure), then an optional
 *  timestamp, an optional pulse-rate SFLOAT, and fields this app doesn't
 *  read (user id, measurement status). Pure and independently testable
 *  from a raw DataView, no Bluetooth connection required — see
 *  js/lib/ieee11073.js for the shared float decoder.
 *
 *  The device's own timestamp field, if present, is skipped: a reading
 *  gets this app's own recordedAt at the moment it's captured, the same
 *  "trust when it actually happened, not what the device's clock says"
 *  choice every other capture path in this app makes. */
export function parseBloodPressureMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  let offset = 1;

  const systolic = parseSFloat(dataView.getUint16(offset, /* littleEndian */ true));
  offset += 2;
  const diastolic = parseSFloat(dataView.getUint16(offset, true));
  offset += 2;
  const meanArterialPressure = parseSFloat(dataView.getUint16(offset, true));
  offset += 2;

  if ((flags & FLAG_TIMESTAMP_PRESENT) !== 0) offset += 7; // year(2) month day hours minutes seconds

  let pulseRate = null;
  if ((flags & FLAG_PULSE_RATE_PRESENT) !== 0) {
    pulseRate = parseSFloat(dataView.getUint16(offset, true));
  }

  return {
    systolic,
    diastolic,
    meanArterialPressure,
    unit: (flags & FLAG_KPA_UNITS) !== 0 ? 'kPa' : 'mmHg',
    pulseRate,
  };
}

/**
 * @param {object} callbacks
 * @param {(reading: ReturnType<typeof parseBloodPressureMeasurement>) => void} callbacks.onReading
 * @param {() => void} [callbacks.onDisconnect]
 * @param {(error: Error) => void} callbacks.onError
 * @returns {Promise<{disconnect: () => void}|null>}
 */
export async function connectBloodPressureMonitor({ onReading, onDisconnect, onError }) {
  return connectBleCharacteristic({
    serviceUuid: BLOOD_PRESSURE_SERVICE,
    characteristicUuid: BLOOD_PRESSURE_MEASUREMENT_CHARACTERISTIC,
    parse: parseBloodPressureMeasurement,
    onReading,
    onDisconnect,
    onError,
  });
}
