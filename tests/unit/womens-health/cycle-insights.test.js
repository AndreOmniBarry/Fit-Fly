import { describe, expect, it } from 'vitest';
import { cycleLengthVariability, symptomFrequency } from '../../../js/features/womens-health/cycle-insights.js';

const SYMPTOM_DEFS = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'bloating', label: 'Bloating' },
];

describe('cycleLengthVariability', () => {
  it('is null with fewer than 2 completed cycles', () => {
    expect(cycleLengthVariability([])).toBeNull();
    expect(cycleLengthVariability(['2026-05-01'])).toBeNull();
    expect(cycleLengthVariability(['2026-05-01', '2026-05-29'])).toBeNull(); // exactly 1 gap
  });

  it('reports real min/max/average/stdDev for a perfectly regular history', () => {
    const regular = ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24', '2026-08-21'];
    expect(cycleLengthVariability(regular)).toEqual({
      averageDays: 28,
      stdDevDays: 0,
      minDays: 28,
      maxDays: 28,
      regularity: 'regular',
    });
  });

  it('flags a genuinely irregular history as such, with real min/max spread', () => {
    const irregular = ['2026-01-01', '2026-01-25', '2026-03-10', '2026-03-20'];
    // gaps: 24, 44, 10
    const result = cycleLengthVariability(irregular);
    expect(result.minDays).toBe(10);
    expect(result.maxDays).toBe(44);
    expect(result.regularity).toBe('irregular');
  });

  it('is "somewhat variable" for a mild, real spread that is neither tightly regular nor wildly irregular', () => {
    // gaps: 26, 30 -> average 28, stdDev 2, cv ~0.071 -> but only 2 gaps
    // logged, so the "regular" bucket (which needs >= 4 gaps) can't apply
    // yet even though the spread itself is tight.
    const mild = ['2026-05-01', '2026-05-27', '2026-06-26'];
    const result = cycleLengthVariability(mild);
    expect(result.regularity).toBe('somewhat variable');
  });
});

describe('symptomFrequency', () => {
  it('is empty with no logged days at all', () => {
    expect(symptomFrequency([], SYMPTOM_DEFS)).toEqual([]);
  });

  it('is empty when logged days exist but no symptom was ever picked', () => {
    expect(symptomFrequency([{ symptoms: [] }, { symptoms: undefined }], SYMPTOM_DEFS)).toEqual([]);
  });

  it('counts real occurrences and computes a real percent of logged days', () => {
    const logs = [
      { symptoms: ['cramps', 'headache'] },
      { symptoms: ['cramps'] },
      { symptoms: [] },
      { symptoms: ['cramps'] },
    ];
    expect(symptomFrequency(logs, SYMPTOM_DEFS)).toEqual([
      { id: 'cramps', label: 'Cramps', count: 3, percent: 75 },
      { id: 'headache', label: 'Headache', count: 1, percent: 25 },
    ]);
  });

  it('sorts by frequency descending, ties broken alphabetically by label', () => {
    const logs = [{ symptoms: ['headache'] }, { symptoms: ['bloating'] }];
    expect(symptomFrequency(logs, SYMPTOM_DEFS).map((s) => s.id)).toEqual(['bloating', 'headache']);
  });

  it('never fabricates an entry for a symptom that was never actually logged', () => {
    const logs = [{ symptoms: ['cramps'] }];
    const result = symptomFrequency(logs, SYMPTOM_DEFS);
    expect(result).toHaveLength(1);
    expect(result.find((s) => s.id === 'bloating')).toBeUndefined();
  });
});
