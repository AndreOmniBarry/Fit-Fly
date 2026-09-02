import { describe, expect, it } from 'vitest';
import {
  categorizeBloodPressure,
  describeBloodPressureCategory,
  isConcerningBloodPressure,
} from '../../../js/features/vitals/blood-pressure-category.js';

describe('categorizeBloodPressure', () => {
  it('is Normal for readings under 120/80', () => {
    expect(categorizeBloodPressure(115, 75)).toBe('normal');
    expect(categorizeBloodPressure(118, 78)).toBe('normal');
  });

  it('is Elevated for 120-129 systolic with diastolic still under 80', () => {
    expect(categorizeBloodPressure(125, 70)).toBe('elevated');
  });

  it('is Hypertension Stage 1 when systolic is 130-139, even with normal diastolic', () => {
    expect(categorizeBloodPressure(135, 70)).toBe('hypertension-stage-1');
  });

  it('is Hypertension Stage 1 when diastolic alone is 80-89, even with normal systolic', () => {
    expect(categorizeBloodPressure(115, 85)).toBe('hypertension-stage-1');
  });

  it('is Hypertension Stage 2 when systolic reaches 140 or diastolic reaches 90', () => {
    expect(categorizeBloodPressure(145, 70)).toBe('hypertension-stage-2');
    expect(categorizeBloodPressure(115, 92)).toBe('hypertension-stage-2');
  });

  it('is Hypertensive Crisis when either number crosses the crisis threshold', () => {
    expect(categorizeBloodPressure(182, 70)).toBe('hypertensive-crisis');
    expect(categorizeBloodPressure(115, 122)).toBe('hypertensive-crisis');
  });

  it('uses whichever number is more severe, not just systolic', () => {
    // systolic reads Normal on its own, but diastolic 125 is a crisis.
    expect(categorizeBloodPressure(110, 125)).toBe('hypertensive-crisis');
  });
});

describe('describeBloodPressureCategory', () => {
  it('describes every category with real, non-empty text', () => {
    for (const category of [
      'normal',
      'elevated',
      'hypertension-stage-1',
      'hypertension-stage-2',
      'hypertensive-crisis',
    ]) {
      expect(describeBloodPressureCategory(category).length).toBeGreaterThan(0);
    }
  });
});

describe('isConcerningBloodPressure', () => {
  it('flags Stage 2 and Crisis as concerning, nothing milder', () => {
    expect(isConcerningBloodPressure('normal')).toBe(false);
    expect(isConcerningBloodPressure('elevated')).toBe(false);
    expect(isConcerningBloodPressure('hypertension-stage-1')).toBe(false);
    expect(isConcerningBloodPressure('hypertension-stage-2')).toBe(true);
    expect(isConcerningBloodPressure('hypertensive-crisis')).toBe(true);
  });
});
