import { describe, expect, it } from 'vitest';
import {
  HR_ZONE,
  classifyHeartRateZone,
  describeHeartRateZone,
  estimateMaxHeartRate,
  isConcerningHeartRateZone,
} from '../../../js/features/heart-rate/hr-zone.js';

describe('estimateMaxHeartRate', () => {
  it('applies the Tanaka formula (208 - 0.7 x age)', () => {
    expect(estimateMaxHeartRate(30)).toBeCloseTo(187, 5);
    expect(estimateMaxHeartRate(40)).toBeCloseTo(180, 5);
    expect(estimateMaxHeartRate(0)).toBeNull(); // not a usable age
  });

  it('returns null for an unusable age (missing, zero, negative)', () => {
    expect(estimateMaxHeartRate(null)).toBeNull();
    expect(estimateMaxHeartRate(undefined)).toBeNull();
    expect(estimateMaxHeartRate(-5)).toBeNull();
  });
});

describe('classifyHeartRateZone — with a known age', () => {
  // age 30 -> HRmax = 187; resting/elevated boundary = 93.5; elevated/high
  // boundary = 158.95
  it('classifies well below 50% of HRmax as resting', () => {
    expect(classifyHeartRateZone(65, 30)).toBe(HR_ZONE.RESTING);
  });

  it('classifies exactly at the 50%-of-HRmax boundary as elevated (inclusive)', () => {
    expect(classifyHeartRateZone(93.5, 30)).toBe(HR_ZONE.ELEVATED);
  });

  it('classifies comfortably between 50% and 85% of HRmax as elevated', () => {
    expect(classifyHeartRateZone(130, 30)).toBe(HR_ZONE.ELEVATED);
  });

  it('classifies exactly at the 85%-of-HRmax boundary as high (inclusive)', () => {
    expect(classifyHeartRateZone(158.95, 30)).toBe(HR_ZONE.HIGH);
  });

  it('classifies well above 85% of HRmax as high', () => {
    expect(classifyHeartRateZone(180, 30)).toBe(HR_ZONE.HIGH);
  });

  it('uses a different, older person\'s lower HRmax — the same 160bpm reads differently by age', () => {
    // age 70 -> HRmax = 159; 160 is *above* that ceiling entirely -> high
    expect(classifyHeartRateZone(160, 70)).toBe(HR_ZONE.HIGH);
    // age 20 -> HRmax = 194; 160/194 = ~82.5%, still under the 85% ceiling -> elevated
    expect(classifyHeartRateZone(160, 20)).toBe(HR_ZONE.ELEVATED);
  });
});

describe('classifyHeartRateZone — no age on file', () => {
  it('falls back to fixed adult thresholds instead of guessing an age', () => {
    expect(classifyHeartRateZone(70)).toBe(HR_ZONE.RESTING);
    expect(classifyHeartRateZone(70, null)).toBe(HR_ZONE.RESTING);
    expect(classifyHeartRateZone(99)).toBe(HR_ZONE.RESTING);
    expect(classifyHeartRateZone(100)).toBe(HR_ZONE.ELEVATED);
    expect(classifyHeartRateZone(139)).toBe(HR_ZONE.ELEVATED);
    expect(classifyHeartRateZone(140)).toBe(HR_ZONE.HIGH);
  });

  it('treats an unusable age the same as no age at all', () => {
    expect(classifyHeartRateZone(120, 0)).toBe(HR_ZONE.ELEVATED);
    expect(classifyHeartRateZone(120, -10)).toBe(HR_ZONE.ELEVATED);
  });
});

describe('classifyHeartRateZone — invalid bpm', () => {
  it('returns null rather than a fabricated zone for a non-positive bpm', () => {
    expect(classifyHeartRateZone(0, 30)).toBeNull();
    expect(classifyHeartRateZone(-5, 30)).toBeNull();
    expect(classifyHeartRateZone(NaN, 30)).toBeNull();
  });
});

describe('describeHeartRateZone / isConcerningHeartRateZone', () => {
  it('labels each zone in plain language', () => {
    expect(describeHeartRateZone(HR_ZONE.RESTING)).toBe('Resting');
    expect(describeHeartRateZone(HR_ZONE.ELEVATED)).toBe('Elevated');
    expect(describeHeartRateZone(HR_ZONE.HIGH)).toBe('High');
    expect(describeHeartRateZone(null)).toBe('—');
  });

  it('flags only "high" as concerning', () => {
    expect(isConcerningHeartRateZone(HR_ZONE.RESTING)).toBe(false);
    expect(isConcerningHeartRateZone(HR_ZONE.ELEVATED)).toBe(false);
    expect(isConcerningHeartRateZone(HR_ZONE.HIGH)).toBe(true);
  });
});
