// IEEE 11073-20601 16-bit SFLOAT decoder — the encoding the Bluetooth
// GATT Blood Pressure and Pulse Oximeter services both use for their
// measurement values (systolic/diastolic/mean-arterial-pressure, SpO2%,
// pulse rate). Pure and independently testable, the same discipline as
// ble-heart-rate.js's parseHeartRateMeasurement.
//
// Layout of the 16-bit value: the top 4 bits are a signed exponent
// (two's complement, -8..7), the bottom 12 bits are a signed mantissa
// (two's complement, -2048..2047). The real value is mantissa * 10^exponent.
// A handful of specific mantissa bit patterns are reserved by the spec for
// non-numeric states (NaN, "not at this resolution", +/-Infinity, and one
// reserved value) — this decoder treats every one of them as "no real
// reading" (null) rather than guessing a number, the same "refuse to
// fabricate a value" contract as everything else measured in this app.
const RESERVED_MANTISSAS = new Set([0x07ff, 0x0800, 0x07fe, 0x0802, 0x0801]);

export function parseSFloat(raw) {
  const mantissaRaw = raw & 0x0fff;
  if (RESERVED_MANTISSAS.has(mantissaRaw)) return null;

  const exponentRaw = (raw >> 12) & 0x0f;
  const mantissa = mantissaRaw >= 0x0800 ? mantissaRaw - 0x1000 : mantissaRaw;
  const exponent = exponentRaw >= 0x8 ? exponentRaw - 0x10 : exponentRaw;
  return mantissa * Math.pow(10, exponent);
}
