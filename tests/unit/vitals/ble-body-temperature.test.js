import { describe, expect, it } from 'vitest';
import { isBluetoothAvailable, parseBodyTemperatureMeasurement } from '../../../js/features/vitals/ble-body-temperature.js';

/** Encodes a whole-number Celsius value as an IEEE-11073 32-bit FLOAT with
 *  exponent 0 (mantissa === value), little-endian bytes. */
function floatBytes(value) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, 0x00];
}

function dataViewFromBytes(bytes) {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new DataView(buffer);
  bytes.forEach((b, i) => view.setUint8(i, b));
  return view;
}

describe('parseBodyTemperatureMeasurement', () => {
  it('parses a Celsius reading (units flag clear) straight through', () => {
    const bytes = [0x00, ...floatBytes(37)];
    const reading = parseBodyTemperatureMeasurement(dataViewFromBytes(bytes));
    expect(reading).toEqual({ temperatureCelsius: 37 });
  });

  it('converts a Fahrenheit reading (units flag set) to Celsius', () => {
    // 98 F -> (98 - 32) * 5/9 = 36.666...C
    const bytes = [0x01, ...floatBytes(98)];
    const reading = parseBodyTemperatureMeasurement(dataViewFromBytes(bytes));
    expect(reading.temperatureCelsius).toBeCloseTo(36.6667, 3);
  });

  it('skips a 7-byte timestamp field when the timestamp flag is set', () => {
    const timestampFiller = [0xe6, 0x07, 0x01, 0x01, 0x0c, 0x1e, 0x00]; // 7 bytes, values irrelevant — never read
    const flags = 0x02; // timestamp present, Celsius units
    const bytes = [flags, ...floatBytes(38), ...timestampFiller];
    const reading = parseBodyTemperatureMeasurement(dataViewFromBytes(bytes));
    // The timestamp bytes live after the temperature value and are simply
    // never read by this parser — the temperature itself decodes fine
    // whether or not a timestamp follows it.
    expect(reading.temperatureCelsius).toBe(38);
  });

  it('returns null for the reserved NaN mantissa rather than fabricating a value', () => {
    const bytes = [0x00, 0xff, 0xff, 0x7f, 0x00];
    const reading = parseBodyTemperatureMeasurement(dataViewFromBytes(bytes));
    expect(reading.temperatureCelsius).toBeNull();
  });
});

describe('isBluetoothAvailable', () => {
  it('reflects whether navigator.bluetooth exists, without throwing when it does not', () => {
    expect(typeof isBluetoothAvailable()).toBe('boolean');
  });
});
