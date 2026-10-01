// Real pulse-oximeter BLE support — same real transport as
// ble-heart-rate.js/ble-blood-pressure.js, via js/lib/bluetooth.js.
import { connectBleCharacteristic, isBluetoothAvailable, sig16BitUuid } from '../../lib/bluetooth.js';
import { parseSFloat } from '../../lib/ieee11073.js';

export { isBluetoothAvailable };

// Bluetooth SIG assigned numbers: Pulse Oximeter service 0x1822, PLX
// Continuous Measurement characteristic 0x2A5F.
const PULSE_OXIMETER_SERVICE = sig16BitUuid('1822');
const PLX_CONTINUOUS_MEASUREMENT_CHARACTERISTIC = sig16BitUuid('2a5f');

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
 * @returns {Promise<{disconnect: () => void}|null>}
 */
export async function connectPulseOximeterMonitor({ onReading, onDisconnect, onError }) {
  return connectBleCharacteristic({
    serviceUuid: PULSE_OXIMETER_SERVICE,
    characteristicUuid: PLX_CONTINUOUS_MEASUREMENT_CHARACTERISTIC,
    parse: parsePulseOximeterMeasurement,
    onReading,
    onDisconnect,
    onError,
  });
}
