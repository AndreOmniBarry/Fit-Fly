import { describe, expect, it } from 'vitest';
import { isBluetoothAvailable, parsePulseOximeterMeasurement } from '../../../js/features/vitals/ble-pulse-oximeter.js';

/** Encodes a whole-number value as an IEEE-11073 SFLOAT with exponent 0
 *  (mantissa === value), little-endian bytes. */
function sfloatBytes(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function dataViewFromBytes(bytes) {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new DataView(buffer);
  bytes.forEach((b, i) => view.setUint8(i, b));
  return view;
}

describe('parsePulseOximeterMeasurement', () => {
  it('parses the unconditional SpO2 + pulse rate pair right after the flags byte', () => {
    const bytes = [0x00, ...sfloatBytes(98), ...sfloatBytes(68)];
    const reading = parsePulseOximeterMeasurement(dataViewFromBytes(bytes));
    expect(reading).toEqual({ spo2: 98, pulseRate: 68 });
  });

  it('ignores any optional trailing fields (fast/slow averages, status) — only the base pair is read', () => {
    const trailingJunk = [0xff, 0xff, 0xff, 0xff, 0xff];
    const bytes = [0x1f, ...sfloatBytes(96), ...sfloatBytes(72), ...trailingJunk];
    const reading = parsePulseOximeterMeasurement(dataViewFromBytes(bytes));
    expect(reading).toEqual({ spo2: 96, pulseRate: 72 });
  });
});

describe('isBluetoothAvailable', () => {
  it('reflects whether navigator.bluetooth exists, without throwing when it does not', () => {
    expect(typeof isBluetoothAvailable()).toBe('boolean');
  });
});
