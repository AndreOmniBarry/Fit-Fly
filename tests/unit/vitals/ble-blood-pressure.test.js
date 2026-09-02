import { describe, expect, it } from 'vitest';
import { isBluetoothAvailable, parseBloodPressureMeasurement } from '../../../js/features/vitals/ble-blood-pressure.js';

/** Encodes a whole-number value as an IEEE-11073 SFLOAT with exponent 0
 *  (mantissa === value), little-endian bytes — every fixture below only
 *  needs whole mmHg values. */
function sfloatBytes(value) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function dataViewFromBytes(bytes) {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new DataView(buffer);
  bytes.forEach((b, i) => view.setUint8(i, b));
  return view;
}

describe('parseBloodPressureMeasurement', () => {
  it('parses systolic/diastolic/MAP in mmHg with no optional fields', () => {
    const bytes = [0x00, ...sfloatBytes(120), ...sfloatBytes(80), ...sfloatBytes(93)];
    const reading = parseBloodPressureMeasurement(dataViewFromBytes(bytes));
    expect(reading).toEqual({ systolic: 120, diastolic: 80, meanArterialPressure: 93, unit: 'mmHg', pulseRate: null });
  });

  it('reports kPa units when the units flag bit is set', () => {
    const bytes = [0x01, ...sfloatBytes(16), ...sfloatBytes(11), ...sfloatBytes(12)];
    const reading = parseBloodPressureMeasurement(dataViewFromBytes(bytes));
    expect(reading.unit).toBe('kPa');
  });

  it('parses a real pulse rate when the pulse-rate flag is set', () => {
    const bytes = [0x04, ...sfloatBytes(130), ...sfloatBytes(85), ...sfloatBytes(100), ...sfloatBytes(72)];
    const reading = parseBloodPressureMeasurement(dataViewFromBytes(bytes));
    expect(reading.pulseRate).toBe(72);
  });

  it('skips a 7-byte timestamp field before reading pulse rate, when both flags are set', () => {
    const timestampFiller = [0xe6, 0x07, 0x01, 0x01, 0x0c, 0x1e, 0x00]; // 7 bytes, values irrelevant — never read
    const flags = 0x02 | 0x04; // timestamp present + pulse rate present
    const bytes = [
      flags,
      ...sfloatBytes(140),
      ...sfloatBytes(90),
      ...sfloatBytes(110),
      ...timestampFiller,
      ...sfloatBytes(75),
    ];
    const reading = parseBloodPressureMeasurement(dataViewFromBytes(bytes));
    expect(reading).toEqual({ systolic: 140, diastolic: 90, meanArterialPressure: 110, unit: 'mmHg', pulseRate: 75 });
  });
});

describe('isBluetoothAvailable', () => {
  it('reflects whether navigator.bluetooth exists, without throwing when it does not', () => {
    expect(typeof isBluetoothAvailable()).toBe('boolean');
  });
});
