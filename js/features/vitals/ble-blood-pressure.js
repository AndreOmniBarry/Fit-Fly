// Web Bluetooth blood-pressure-cuff support — same feature-detected,
// degrade-gracefully contract as ble-heart-rate.js, reusing its shared
// isBluetoothAvailable() check.
import { isBluetoothAvailable } from '../../lib/bluetooth.js';
import { parseSFloat } from '../../lib/ieee11073.js';

export { isBluetoothAvailable };

const BLOOD_PRESSURE_SERVICE = 'blood_pressure';
const BLOOD_PRESSURE_MEASUREMENT_CHARACTERISTIC = 'blood_pressure_measurement';

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
 * @returns {Promise<{device: BluetoothDevice, disconnect: () => void}|null>}
 */
export async function connectBloodPressureMonitor({ onReading, onDisconnect, onError }) {
  if (!isBluetoothAvailable()) {
    onError?.(new Error('This browser doesn\'t support Bluetooth — try a manual entry instead.'));
    return null;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLOOD_PRESSURE_SERVICE] }],
    });
    device.addEventListener('gattserverdisconnected', () => onDisconnect?.());

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLOOD_PRESSURE_SERVICE);
    const characteristic = await service.getCharacteristic(BLOOD_PRESSURE_MEASUREMENT_CHARACTERISTIC);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      onReading?.(parseBloodPressureMeasurement(event.target.value));
    });

    return { device, disconnect: () => device.gatt?.disconnect() };
  } catch (err) {
    onError?.(err);
    return null;
  }
}
