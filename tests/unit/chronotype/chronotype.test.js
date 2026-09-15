import { describe, expect, it } from 'vitest';
import {
  scoreChronotype,
  describeChronotypeCategory,
  chronotypeCategoryLabel,
  CHRONOTYPE_QUESTIONS,
  CHRONOTYPE_MIN_TOTAL,
  CHRONOTYPE_MAX_TOTAL,
} from '../../../js/features/chronotype/chronotype.js';

const FIELDS = ['riseTime', 'sleepReadyTime', 'peakSharpnessWindow', 'morningGrogginess', 'eveningWindDown', 'selfAnchor'];

function answers(a, b, c, d, e, f) {
  return {
    riseTime: a,
    sleepReadyTime: b,
    peakSharpnessWindow: c,
    morningGrogginess: d,
    eveningWindDown: e,
    selfAnchor: f,
  };
}

/** Builds a valid 6-item answer set (each 1-7) summing to exactly `total`,
 *  by filling each slot from 1 up to 7 in turn — used to hit every
 *  boundary total precisely without hand-picking six numbers each time. */
function answersSummingTo(total) {
  const values = [1, 1, 1, 1, 1, 1];
  let remaining = total - 6;
  for (let i = 0; i < values.length && remaining > 0; i++) {
    const add = Math.min(remaining, 6);
    values[i] += add;
    remaining -= add;
  }
  return answers(...values);
}

describe('CHRONOTYPE_QUESTIONS', () => {
  it('has exactly 6 questions, each with 7 options scored 1-7 in strongest-evening-to-morning order', () => {
    expect(CHRONOTYPE_QUESTIONS).toHaveLength(6);
    for (const q of CHRONOTYPE_QUESTIONS) {
      expect(q.options).toHaveLength(7);
      expect(q.options.map((o) => o.points)).toEqual([7, 6, 5, 4, 3, 2, 1]);
      expect(FIELDS).toContain(q.id);
    }
    // Every ChronotypeAnswers field is covered by exactly one question.
    expect(CHRONOTYPE_QUESTIONS.map((q) => q.id).sort()).toEqual([...FIELDS].sort());
  });
});

describe('scoreChronotype', () => {
  it('sums the 6 answers into the total', () => {
    const result = scoreChronotype(answers(7, 6, 5, 4, 3, 2));
    expect(result.total).toBe(27);
  });

  it('minimum possible total (6) is definite-evening', () => {
    const result = scoreChronotype(answers(1, 1, 1, 1, 1, 1));
    expect(result.total).toBe(CHRONOTYPE_MIN_TOTAL);
    expect(result.total).toBe(6);
    expect(result.category).toBe('definite-evening');
  });

  it('maximum possible total (42) is definite-morning', () => {
    const result = scoreChronotype(answers(7, 7, 7, 7, 7, 7));
    expect(result.total).toBe(CHRONOTYPE_MAX_TOTAL);
    expect(result.total).toBe(42);
    expect(result.category).toBe('definite-morning');
  });

  describe('category boundaries (both edges inclusive)', () => {
    const cases = [
      [6, 'definite-evening'],
      [16, 'definite-evening'],
      [17, 'moderate-evening'],
      [21, 'moderate-evening'],
      [22, 'balanced'],
      [27, 'balanced'],
      [28, 'moderate-morning'],
      [32, 'moderate-morning'],
      [33, 'definite-morning'],
      [42, 'definite-morning'],
    ];

    for (const [total, expectedCategory] of cases) {
      it(`total ${total} -> ${expectedCategory}`, () => {
        const result = scoreChronotype(answersSummingTo(total));
        expect(result.total).toBe(total);
        expect(result.category).toBe(expectedCategory);
      });
    }
  });

  it('a realistic strong night-owl answer set scores definite-evening', () => {
    // Very late rise/sleep-ready/peak-focus times, minimal grogginess
    // relative to a late wake, very late wind-down, strongly self-IDs as
    // an evening person.
    const result = scoreChronotype(answers(2, 1, 2, 3, 1, 1));
    expect(result.total).toBe(10);
    expect(result.category).toBe('definite-evening');
  });

  it('a realistic mild evening-leaning answer set scores moderate-evening', () => {
    const result = scoreChronotype(answers(4, 3, 3, 4, 4, 3));
    expect(result.total).toBe(21);
    expect(result.category).toBe('moderate-evening');
  });

  it('a realistic "depends on the day" answer set scores balanced', () => {
    const result = scoreChronotype(answers(4, 4, 5, 5, 4, 4));
    expect(result.total).toBe(26);
    expect(result.category).toBe('balanced');
  });

  it('a realistic mild morning-leaning answer set scores moderate-morning', () => {
    const result = scoreChronotype(answers(5, 5, 5, 5, 5, 6));
    expect(result.total).toBe(31);
    expect(result.category).toBe('moderate-morning');
  });

  it('a realistic strong early-bird answer set scores definite-morning', () => {
    const result = scoreChronotype(answers(7, 7, 6, 7, 6, 7));
    expect(result.total).toBe(40);
    expect(result.category).toBe('definite-morning');
  });
});

describe('chronotypeCategoryLabel / describeChronotypeCategory', () => {
  const categories = ['definite-evening', 'moderate-evening', 'balanced', 'moderate-morning', 'definite-morning'];

  it('returns a non-empty label and description for every real category', () => {
    for (const category of categories) {
      expect(chronotypeCategoryLabel(category)).toBeTruthy();
      expect(describeChronotypeCategory(category)).toBeTruthy();
    }
  });

  it('never prescribes a specific action (e.g. "exercise at ...") — descriptive only', () => {
    for (const category of categories) {
      const text = describeChronotypeCategory(category).toLowerCase();
      expect(text).not.toMatch(/should (exercise|work out|train)/);
    }
  });
});
