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
    expect(parseHeartRateMeasurement(view)).toEqual({ bpm: 72, rrIntervalsMs: [] });
  });

  it('parses a UINT16-encoded reading (flags low bit = 1), little-endian', () => {
    // flags=0x01 (16-bit value), bpm=300 (0x012C) as little-endian bytes [0x2C, 0x01]
    const view = dataViewFromBytes([0x01, 0x2c, 0x01]);
    expect(parseHeartRateMeasurement(view)).toEqual({ bpm: 300, rrIntervalsMs: [] });
  });

  it('ignores other flag bits when determining the encoding', () => {
    // flags=0x06 (sensor-contact bits set, value-format bit still 0) -> 8-bit
    const view = dataViewFromBytes([0x06, 65]);
    expect(parseHeartRateMeasurement(view)).toEqual({ bpm: 65, rrIntervalsMs: [] });
  });

  it('extracts one RR-interval when the RR-interval-present flag (bit 4) is set', () => {
    // flags=0x10 (8-bit value, RR-interval present), bpm=70,
    // one RR-interval of 1024 (1/1024ths) = exactly 1000ms, little-endian [0x00, 0x04]
    const view = dataViewFromBytes([0x10, 70, 0x00, 0x04]);
    const result = parseHeartRateMeasurement(view);
    expect(result.bpm).toBe(70);
    expect(result.rrIntervalsMs).toEqual([1000]);
  });

  it('extracts multiple RR-intervals from a single notification', () => {
    // flags=0x10, bpm=70, two RR-intervals: 512 (=500ms) and 1024 (=1000ms)
    const view = dataViewFromBytes([0x10, 70, 0x00, 0x02, 0x00, 0x04]);
    expect(parseHeartRateMeasurement(view).rrIntervalsMs).toEqual([500, 1000]);
  });

  it('skips the Energy Expended field (bit 3) before reading RR-intervals', () => {
    // flags=0x18 (energy expended + RR-interval present), bpm=70,
    // energy=0x00C8 (200, irrelevant to this parse), RR-interval=1024 (=1000ms)
    const view = dataViewFromBytes([0x18, 70, 0xc8, 0x00, 0x00, 0x04]);
    const result = parseHeartRateMeasurement(view);
    expect(result.bpm).toBe(70);
    expect(result.rrIntervalsMs).toEqual([1000]);
  });

  it('a UINT16 bpm value with RR-intervals reads both correctly, in order', () => {
    // flags=0x11 (16-bit value + RR-interval present), bpm=300 (0x012C),
    // RR-interval=1024 (=1000ms)
    const view = dataViewFromBytes([0x11, 0x2c, 0x01, 0x00, 0x04]);
    const result = parseHeartRateMeasurement(view);
    expect(result.bpm).toBe(300);
    expect(result.rrIntervalsMs).toEqual([1000]);
  });

  it('returns an empty rrIntervalsMs array when the flag bit is not set, even with extra trailing bytes', () => {
    const view = dataViewFromBytes([0x00, 72, 0xff, 0xff]);
    expect(parseHeartRateMeasurement(view).rrIntervalsMs).toEqual([]);
  });
});

describe('isBluetoothAvailable', () => {
  it('reflects whether navigator.bluetooth exists, without throwing when it does not', () => {
    expect(typeof isBluetoothAvailable()).toBe('boolean');
  });
});
