// IEEE 11073-20601 float decoders — the encodings the Bluetooth GATT
// health-device services use for their measurement values: the 16-bit
// SFLOAT (Blood Pressure's systolic/diastolic/mean-arterial-pressure,
// Pulse Oximeter's SpO2%/pulse rate) and the 32-bit FLOAT (Health
// Thermometer's temperature). Pure and independently testable, the same
// discipline as ble-heart-rate.js's parseHeartRateMeasurement.
//
// Layout of the 16-bit SFLOAT: the top 4 bits are a signed exponent
// (two's complement, -8..7), the bottom 12 bits are a signed mantissa
// (two's complement, -2048..2047). The real value is mantissa * 10^exponent.
// A handful of specific mantissa bit patterns are reserved by the spec for
// non-numeric states (NaN, "not at this resolution", +/-Infinity, and one
// reserved value) — this decoder treats every one of them as "no real
// reading" (null) rather than guessing a number, the same "refuse to
// fabricate a value" contract as everything else measured in this app.
const RESERVED_SFLOAT_MANTISSAS = new Set([0x07ff, 0x0800, 0x07fe, 0x0802, 0x0801]);

export function parseSFloat(raw) {
  const mantissaRaw = raw & 0x0fff;
  if (RESERVED_SFLOAT_MANTISSAS.has(mantissaRaw)) return null;

  const exponentRaw = (raw >> 12) & 0x0f;
  const mantissa = mantissaRaw >= 0x0800 ? mantissaRaw - 0x1000 : mantissaRaw;
  const exponent = exponentRaw >= 0x8 ? exponentRaw - 0x10 : exponentRaw;
  return mantissa * Math.pow(10, exponent);
}

// Layout of the 32-bit FLOAT (used by Health Thermometer's Temperature
// Measurement, 0x2A1C): the top 8 bits are a signed exponent (two's
// complement, -128..127), the bottom 24 bits are a signed mantissa (two's
// complement). Same mantissa * 10^exponent formula and the same reserved-
// mantissa-means-null contract as SFLOAT above, just scaled to 24 bits
// (0x7FFFFE/0x7FFFFF/0x800000/0x800001/0x800002 in place of SFLOAT's
// 0x07FE/0x07FF/0x0800/0x0801/0x0802).
const RESERVED_FLOAT_MANTISSAS = new Set([0x7fffff, 0x800000, 0x7ffffe, 0x800002, 0x800001]);

export function parseFloat11073(raw) {
  const mantissaRaw = raw & 0xffffff;
  if (RESERVED_FLOAT_MANTISSAS.has(mantissaRaw)) return null;

  const exponentRaw = (raw >>> 24) & 0xff;
  const mantissa = mantissaRaw >= 0x800000 ? mantissaRaw - 0x1000000 : mantissaRaw;
  const exponent = exponentRaw >= 0x80 ? exponentRaw - 0x100 : exponentRaw;
  return mantissa * Math.pow(10, exponent);
}
