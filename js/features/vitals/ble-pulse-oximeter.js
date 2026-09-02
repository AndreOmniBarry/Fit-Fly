// Web Bluetooth pulse-oximeter support — same feature-detected,
// degrade-gracefully contract as ble-heart-rate.js/ble-blood-pressure.js.
import { isBluetoothAvailable } from '../../lib/bluetooth.js';
import { parseSFloat } from '../../lib/ieee11073.js';

export { isBluetoothAvailable };

const PULSE_OXIMETER_SERVICE = 'pulse_oximeter';
const PLX_CONTINUOUS_MEASUREMENT_CHARACTERISTIC = 'plx_continuous_measurement';

/** Parses the standard Bluetooth SIG PLX Continuous Measurement
 *  characteristic: a flags byte, then the unconditional "SpO2PR-Normal"
 *  field — one IEEE-11073 SFLOAT for SpO2 (%), one for pulse rate (bpm).
 *  Optional fast/slow-averaged readings and status fields, if present,
 *  come after and are deliberately not read — this app only wants the
 *  instantaneous pair, the same "one honest number, not several competing
 *  ones" choice as the rest of this app's readings. Pure and
 *  independently testable from a raw DataView. */
export function parsePulseOximeterMeasurement(dataView) {
  const spo2 = parseSFloat(dataView.getUint16(1, /* littleEndian */ true));
  const pulseRate = parseSFloat(dataView.getUint16(3, true));
  return { spo2, pulseRate };
}

/**
 * @param {object} callbacks
 * @param {(reading: ReturnType<typeof parsePulseOximeterMeasurement>) => void} callbacks.onReading
 * @param {() => void} [callbacks.onDisconnect]
 * @param {(error: Error) => void} callbacks.onError
 * @returns {Promise<{device: BluetoothDevice, disconnect: () => void}|null>}
 */
export async function connectPulseOximeterMonitor({ onReading, onDisconnect, onError }) {
  if (!isBluetoothAvailable()) {
    onError?.(new Error('This browser doesn\'t support Bluetooth — try a manual entry instead.'));
    return null;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PULSE_OXIMETER_SERVICE] }],
    });
    device.addEventListener('gattserverdisconnected', () => onDisconnect?.());

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(PULSE_OXIMETER_SERVICE);
    const characteristic = await service.getCharacteristic(PLX_CONTINUOUS_MEASUREMENT_CHARACTERISTIC);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      onReading?.(parsePulseOximeterMeasurement(event.target.value));
    });

    return { device, disconnect: () => device.gatt?.disconnect() };
  } catch (err) {
    onError?.(err);
    return null;
  }
}
