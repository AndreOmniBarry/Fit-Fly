// Real body-temperature-thermometer BLE support — same real transport as
// ble-heart-rate.js/ble-blood-pressure.js/ble-pulse-oximeter.js, via
// js/lib/bluetooth.js.
import { connectBleCharacteristic, isBluetoothAvailable, sig16BitUuid } from '../../lib/bluetooth.js';
import { parseFloat11073 } from '../../lib/ieee11073.js';

export { isBluetoothAvailable };

// Bluetooth SIG assigned numbers: Health Thermometer service 0x1809,
// Temperature Measurement characteristic 0x2A1C.
const HEALTH_THERMOMETER_SERVICE = sig16BitUuid('1809');
const TEMPERATURE_MEASUREMENT_CHARACTERISTIC = sig16BitUuid('2a1c');

const FLAG_FAHRENHEIT_UNITS = 0x1;
const FLAG_TIMESTAMP_PRESENT = 0x2;
const FLAG_TEMPERATURE_TYPE_PRESENT = 0x4;

/** Parses the standard Bluetooth SIG Health Thermometer "Temperature
 *  Measurement" characteristic (0x2A1C): a flags byte, then one
 *  IEEE-11073 32-bit FLOAT for the temperature, then an optional
 *  timestamp and an optional temperature-type enum. Pure and
 *  independently testable from a raw DataView, no Bluetooth connection
 *  required — see js/lib/ieee11073.js for the shared float decoder.
 *
 *  Always returns the temperature converted to Celsius, regardless of
 *  which unit the device reported in — one honest unit for every reading
 *  this app stores and categorizes, the same "normalize at the edge"
 *  choice ble-blood-pressure.js makes by always returning both mmHg and
 *  the raw unit rather than making every caller convert.
 *
 *  The device's own timestamp field, if present, is skipped, and the
 *  temperature-type field (armpit/oral/ear/etc.) isn't read either — this
 *  app records one body-temperature number, not which site it came from
 *  — same "this app's own recordedAt, one honest number" choice as
 *  ble-blood-pressure.js and ble-pulse-oximeter.js. */
export function parseBodyTemperatureMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const isFahrenheit = (flags & FLAG_FAHRENHEIT_UNITS) !== 0;

  const raw = dataView.getUint32(1, /* littleEndian */ true);
  const value = parseFloat11073(raw);
  const temperatureCelsius = value == null ? null : isFahrenheit ? ((value - 32) * 5) / 9 : value;

  return { temperatureCelsius };
}

/**
 * @param {object} callbacks
 * @param {(reading: ReturnType<typeof parseBodyTemperatureMeasurement>) => void} callbacks.onReading
 * @param {() => void} [callbacks.onDisconnect]
 * @param {(error: Error) => void} callbacks.onError
 * @returns {Promise<{disconnect: () => void}|null>}
 */
export async function connectBodyTemperatureMonitor({ onReading, onDisconnect, onError }) {
  return connectBleCharacteristic({
    serviceUuid: HEALTH_THERMOMETER_SERVICE,
    characteristicUuid: TEMPERATURE_MEASUREMENT_CHARACTERISTIC,
    parse: parseBodyTemperatureMeasurement,
    onReading,
    onDisconnect,
    onError,
  });
}
