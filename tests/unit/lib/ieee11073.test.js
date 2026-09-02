import { describe, expect, it } from 'vitest';
import { parseSFloat } from '../../../js/lib/ieee11073.js';

describe('parseSFloat', () => {
  it('decodes a whole number with exponent 0', () => {
    // mantissa=120, exponent=0 -> raw = (0 << 12) | 120
    expect(parseSFloat((0 << 12) | 120)).toBe(120);
  });

  it('decodes a value with a negative exponent (one decimal place)', () => {
    // 36.5 -> mantissa=365, exponent=-1. Exponent -1 as 4-bit two's
    // complement is 0xF.
    const raw = (0xf << 12) | 365;
    expect(parseSFloat(raw)).toBeCloseTo(36.5, 10);
  });

  it('decodes a value with a positive exponent', () => {
    // mantissa=12, exponent=1 -> 120
    const raw = (0x1 << 12) | 12;
    expect(parseSFloat(raw)).toBe(120);
  });

  it('decodes a negative mantissa (12-bit two\'s complement)', () => {
    // mantissa=-5, exponent=0 -> raw mantissa bits = 0x1000 - 5 = 0xFFB
    const raw = (0x0 << 12) | 0xffb;
    expect(parseSFloat(raw)).toBe(-5);
  });

  it('treats the reserved NaN mantissa (0x07FF) as no reading', () => {
    expect(parseSFloat((0x0 << 12) | 0x07ff)).toBeNull();
  });

  it('treats the reserved NRes mantissa (0x0800) as no reading', () => {
    expect(parseSFloat((0x0 << 12) | 0x0800)).toBeNull();
  });

  it('treats the reserved +Infinity mantissa (0x07FE) as no reading', () => {
    expect(parseSFloat((0x0 << 12) | 0x07fe)).toBeNull();
  });

  it('treats the reserved -Infinity mantissa (0x0802) as no reading', () => {
    expect(parseSFloat((0x0 << 12) | 0x0802)).toBeNull();
  });

  it('treats the reserved-for-future-use mantissa (0x0801) as no reading', () => {
    expect(parseSFloat((0x0 << 12) | 0x0801)).toBeNull();
  });
});
