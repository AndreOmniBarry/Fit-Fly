import { describe, expect, it } from 'vitest';
import { isBluetoothAvailable, parseHeartRateMeasurement } from '../../../js/features/heart-rate/ble-heart-rate.js';

function dataViewFromBytes(bytes) {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new DataView(buffer);
  bytes.forEach((b, i) => view.setUint8(i, b));
  return view;
}

describe('parseHeartRateMeasurement', () => {
  it('parses a UINT8-encoded reading (flags low bit = 0)', () => {
    // flags=0x00 (8-bit value), bpm=72
    const view = dataViewFromBytes([0x00, 72]);
    expect(parseHeartRateMeasurement(view)).toBe(72);
  });

  it('parses a UINT16-encoded reading (flags low bit = 1), little-endian', () => {
    // flags=0x01 (16-bit value), bpm=300 (0x012C) as little-endian bytes [0x2C, 0x01]
    const view = dataViewFromBytes([0x01, 0x2c, 0x01]);
    expect(parseHeartRateMeasurement(view)).toBe(300);
  });

  it('ignores other flag bits when determining the encoding', () => {
    // flags=0x06 (sensor-contact bits set, value-format bit still 0) -> 8-bit
    const view = dataViewFromBytes([0x06, 65]);
    expect(parseHeartRateMeasurement(view)).toBe(65);
  });
});

describe('isBluetoothAvailable', () => {
  it('reflects whether navigator.bluetooth exists, without throwing when it does not', () => {
    expect(typeof isBluetoothAvailable()).toBe('boolean');
  });
});
