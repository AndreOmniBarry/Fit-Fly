import { describe, expect, it } from 'vitest';
import {
  evaluateRedFlags,
  hasRedFlags,
  RED_FLAG_SYMPTOMS,
} from '../../../js/features/onboarding/safety-screen.js';

describe('evaluateRedFlags / hasRedFlags', () => {
  it('no selections means no red flags', () => {
    expect(evaluateRedFlags([])).toEqual([]);
    expect(hasRedFlags([])).toBe(false);
    expect(hasRedFlags(undefined)).toBe(false);
  });

  it('recognizes a real symptom id', () => {
    const id = RED_FLAG_SYMPTOMS[0].id;
    expect(evaluateRedFlags([id])).toEqual([id]);
    expect(hasRedFlags([id])).toBe(true);
  });

  it('ignores unrecognized ids defensively', () => {
    expect(evaluateRedFlags(['not-a-real-symptom'])).toEqual([]);
    expect(hasRedFlags(['not-a-real-symptom'])).toBe(false);
  });

  it('every symptom has a stable id and a human label', () => {
    for (const symptom of RED_FLAG_SYMPTOMS) {
      expect(symptom.id).toMatch(/^[a-z-]+$/);
      expect(symptom.label.length).toBeGreaterThan(10);
    }
  });
});
