// Web Bluetooth heart-rate-strap support, feature-detected — it's a
// Chrome/Android-family API with no Safari/iOS implementation at all
// (see the README's platform notes), so this always has to degrade
// gracefully rather than assume it's there.

const HEART_RATE_SERVICE = 'heart_rate';
const HEART_RATE_MEASUREMENT_CHARACTERISTIC = 'heart_rate_measurement';

export function isBluetoothAvailable() {
  return 'bluetooth' in navigator;
}

/** Parses the standard Bluetooth SIG Heart Rate Measurement
 *  characteristic format: byte 0 is a flags field whose low bit says
 *  whether the value is UINT8 or UINT16 (a strap only switches to 16-bit
 *  encoding for readings above 255 bpm, which is essentially never, but
 *  the spec allows it). Pure and independently testable from a raw
 *  DataView, no Bluetooth connection required. */
export function parseHeartRateMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const valueIs16Bit = (flags & 0x1) === 1;
  return valueIs16Bit ? dataView.getUint16(1, /* littleEndian */ true) : dataView.getUint8(1);
}

/**
 * @param {object} callbacks
 * @param {(bpm: number) => void} callbacks.onReading
 * @param {() => void} [callbacks.onDisconnect]
 * @param {(error: Error) => void} callbacks.onError
 * @returns {Promise<{device: BluetoothDevice, disconnect: () => void}|null>}
 */
export async function connectHeartRateMonitor({ onReading, onDisconnect, onError }) {
  if (!isBluetoothAvailable()) {
    onError?.(new Error('This browser doesn\'t support Bluetooth — try a manual entry instead.'));
    return null;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HEART_RATE_SERVICE] }],
    });
    device.addEventListener('gattserverdisconnected', () => onDisconnect?.());

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT_CHARACTERISTIC);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      onReading?.(parseHeartRateMeasurement(event.target.value));
    });

    return { device, disconnect: () => device.gatt?.disconnect() };
  } catch (err) {
    onError?.(err);
    return null;
  }
}
