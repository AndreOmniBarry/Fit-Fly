import { describe, expect, it } from 'vitest';
import {
  categorizeBodyTemperature,
  describeBodyTemperatureCategory,
  isConcerningBodyTemperature,
} from '../../../js/features/vitals/body-temperature-category.js';

describe('categorizeBodyTemperature', () => {
  it('flags a reading below 35.0C as hypothermia risk', () => {
    expect(categorizeBodyTemperature(34.9)).toBe('hypothermia-risk');
    expect(categorizeBodyTemperature(30)).toBe('hypothermia-risk');
  });

  it('flags a reading from 35.0C up to just under 36.1C as low', () => {
    expect(categorizeBodyTemperature(35.0)).toBe('low');
    expect(categorizeBodyTemperature(36.0)).toBe('low');
  });

  it("categorizes Mayo Clinic's own normal range (36.1-37.2C) as normal", () => {
    expect(categorizeBodyTemperature(36.1)).toBe('normal');
    expect(categorizeBodyTemperature(37.0)).toBe('normal');
    expect(categorizeBodyTemperature(37.2)).toBe('normal');
  });

  it('categorizes just above normal but below the fever threshold as elevated', () => {
    expect(categorizeBodyTemperature(37.3)).toBe('elevated');
    expect(categorizeBodyTemperature(37.9)).toBe('elevated');
  });

  it('categorizes 38.0C (100.4F, the Mayo/CDC fever threshold) and up as fever', () => {
    expect(categorizeBodyTemperature(38.0)).toBe('fever');
    expect(categorizeBodyTemperature(39.3)).toBe('fever');
  });

  it("categorizes 39.4C (103F, Mayo Clinic's 'call your doctor' threshold) and up as high fever", () => {
    expect(categorizeBodyTemperature(39.4)).toBe('high-fever');
    expect(categorizeBodyTemperature(41)).toBe('high-fever');
  });
});

describe('describeBodyTemperatureCategory', () => {
  it('describes every category with a real label', () => {
    expect(describeBodyTemperatureCategory('hypothermia-risk')).toContain('Hypothermia');
    expect(describeBodyTemperatureCategory('low')).toBe('Low');
    expect(describeBodyTemperatureCategory('normal')).toBe('Normal');
    expect(describeBodyTemperatureCategory('elevated')).toBe('Elevated');
    expect(describeBodyTemperatureCategory('fever')).toBe('Fever');
    expect(describeBodyTemperatureCategory('high-fever')).toContain('High fever');
  });
});

describe('isConcerningBodyTemperature', () => {
  it('flags only the two real emergency-care thresholds as concerning', () => {
    expect(isConcerningBodyTemperature('hypothermia-risk')).toBe(true);
    expect(isConcerningBodyTemperature('high-fever')).toBe(true);
    expect(isConcerningBodyTemperature('low')).toBe(false);
    expect(isConcerningBodyTemperature('normal')).toBe(false);
    expect(isConcerningBodyTemperature('elevated')).toBe(false);
    expect(isConcerningBodyTemperature('fever')).toBe(false);
  });
});
