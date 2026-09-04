// Web Bluetooth heart-rate-strap support, feature-detected — it's a
// Chrome/Android-family API with no Safari/iOS implementation at all
// (see the README's platform notes), so this always has to degrade
// gracefully rather than assume it's there. The feature-detect itself
// (isBluetoothAvailable) now lives in js/lib/bluetooth.js, shared with
// Vitals' own blood-pressure/pulse-oximeter BLE integrations — re-exported
// here so nothing importing it from this file has to change.
import { isBluetoothAvailable } from '../../lib/bluetooth.js';

export { isBluetoothAvailable };

const HEART_RATE_SERVICE = 'heart_rate';
const HEART_RATE_MEASUREMENT_CHARACTERISTIC = 'heart_rate_measurement';

const RR_INTERVAL_PRESENT_FLAG = 0x10; // bit 4
const ENERGY_EXPENDED_PRESENT_FLAG = 0x08; // bit 3

/** Parses the standard Bluetooth SIG Heart Rate Measurement
 *  characteristic format: byte 0 is a flags field whose low bit says
 *  whether the value is UINT8 or UINT16 (a strap only switches to 16-bit
 *  encoding for readings above 255 bpm, which is essentially never, but
 *  the spec allows it). Pure and independently testable from a raw
 *  DataView, no Bluetooth connection required.
 *
 *  Also extracts RR-intervals when the strap includes them (flag bit 4)
 *  — real beat-to-beat timing data the characteristic already carries on
 *  many chest straps, previously read and discarded entirely. Each
 *  RR-interval is transmitted in units of 1/1024 second; converted here
 *  to milliseconds. Optional Energy Expended field (bit 3), when
 *  present, is skipped over correctly rather than misread as the start
 *  of the RR-interval data.
 * @returns {{bpm: number, rrIntervalsMs: number[]}} rrIntervalsMs is
 *   empty when this strap/notification doesn't include any — never
 *   fabricated from the bpm value.
 */
export function parseHeartRateMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const valueIs16Bit = (flags & 0x1) === 1;
  const bpm = valueIs16Bit ? dataView.getUint16(1, /* littleEndian */ true) : dataView.getUint8(1);

  let offset = valueIs16Bit ? 3 : 2;
  if (flags & ENERGY_EXPENDED_PRESENT_FLAG) offset += 2; // UINT16 Energy Expended field, skipped

  const rrIntervalsMs = [];
  if (flags & RR_INTERVAL_PRESENT_FLAG) {
    for (; offset + 1 < dataView.byteLength; offset += 2) {
      const rrIn1024ths = dataView.getUint16(offset, /* littleEndian */ true);
      rrIntervalsMs.push((rrIn1024ths / 1024) * 1000);
    }
  }

  return { bpm, rrIntervalsMs };
}

/**
 * @param {object} callbacks
 * @param {(bpm: number, rrIntervalsMs: number[]) => void} callbacks.onReading -
 *   rrIntervalsMs is empty when this notification carried none (most
 *   optical wrist straps never do; many chest straps always do)
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
      const { bpm, rrIntervalsMs } = parseHeartRateMeasurement(event.target.value);
      onReading?.(bpm, rrIntervalsMs);
    });

    return { device, disconnect: () => device.gatt?.disconnect() };
  } catch (err) {
    onError?.(err);
    return null;
  }
}
