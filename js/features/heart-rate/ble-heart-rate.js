// Real heart-rate-strap BLE support — real native BluetoothGatt inside
// the installed app (Android), real Web Bluetooth in a plain browser tab,
// through the one shared transport in js/lib/bluetooth.js (see that
// file's own doc comment for why/how). isBluetoothAvailable re-exported
// here so nothing importing it from this file has to change.
import { connectBleCharacteristic, isBluetoothAvailable, sig16BitUuid } from '../../lib/bluetooth.js';

export { isBluetoothAvailable };

// Bluetooth SIG assigned numbers (Heart Rate service 0x180D, Heart Rate
// Measurement characteristic 0x2A37) — real, standard GATT UUIDs, not
// vendor-specific ones.
const HEART_RATE_SERVICE = sig16BitUuid('180d');
const HEART_RATE_MEASUREMENT_CHARACTERISTIC = sig16BitUuid('2a37');

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
 * @returns {Promise<{disconnect: () => void}|null>}
 */
export async function connectHeartRateMonitor({ onReading, onDisconnect, onError }) {
  return connectBleCharacteristic({
    serviceUuid: HEART_RATE_SERVICE,
    characteristicUuid: HEART_RATE_MEASUREMENT_CHARACTERISTIC,
    parse: parseHeartRateMeasurement,
    onReading: ({ bpm, rrIntervalsMs }) => onReading?.(bpm, rrIntervalsMs),
    onDisconnect,
    onError,
  });
}
