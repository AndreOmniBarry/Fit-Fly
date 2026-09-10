import { describe, expect, it } from 'vitest';
import {
  CLOSE_TO_TARGET_PHRASES,
  STREAK_RISK_PHRASES,
  pickMilestoneMessage,
  pickPhrase,
} from '../../../js/features/goals/goal-phrases.js';
import { MILESTONE_MESSAGES, MILESTONE_THRESHOLDS } from '../../../js/features/goals/milestones.js';

const ACTIVITY_TYPES = ['walk', 'run', 'hydration', 'sleep', 'strength', 'weight', 'cardio', 'skill', 'generic'];

describe('pickPhrase', () => {
  it('is deterministic for an injected random function', () => {
    const phrases = ['a', 'b', 'c'];
    expect(pickPhrase(phrases, () => 0)).toBe('a');
    expect(pickPhrase(phrases, () => 0.99)).toBe('c');
  });

  it('never returns undefined even at the exact upper edge of Math.random()', () => {
    const phrases = ['a', 'b'];
    expect(pickPhrase(phrases, () => 1)).toBeDefined();
  });
});

describe('phrase banks: every real activity type has real, varied, non-generic-sounding copy', () => {
  it.each(ACTIVITY_TYPES)('STREAK_RISK_PHRASES has at least 2 distinct phrases for "%s"', (type) => {
    const phrases = STREAK_RISK_PHRASES[type];
    expect(phrases.length).toBeGreaterThanOrEqual(2);
    expect(new Set(phrases).size).toBe(phrases.length); // no accidental duplicates
    for (const phrase of phrases) expect(phrase.length).toBeGreaterThan(10);
  });

  it.each(ACTIVITY_TYPES)('CLOSE_TO_TARGET_PHRASES has at least 2 distinct phrases for "%s"', (type) => {
    const phrases = CLOSE_TO_TARGET_PHRASES[type];
    expect(phrases.length).toBeGreaterThanOrEqual(2);
    expect(new Set(phrases).size).toBe(phrases.length);
    for (const phrase of phrases) expect(phrase.length).toBeGreaterThan(10);
  });

  it('walk and run get genuinely different streak-risk copy, not the same line reused', () => {
    const overlap = STREAK_RISK_PHRASES.walk.filter((p) => STREAK_RISK_PHRASES.run.includes(p));
    expect(overlap).toEqual([]);
  });
});

describe('pickMilestoneMessage', () => {
  it('returns the plain generic message for an unrecognized activity type', () => {
    for (const threshold of MILESTONE_THRESHOLDS) {
      expect(pickMilestoneMessage('generic', threshold)).toBe(MILESTONE_MESSAGES[threshold]);
    }
  });

  it('returns an activity-flavored message for a known type, different from the generic one', () => {
    const walkMessage = pickMilestoneMessage('walk', 50);
    expect(walkMessage).not.toBe(MILESTONE_MESSAGES[50]);
    expect(walkMessage.length).toBeGreaterThan(10);
  });

  it('is stable — the same threshold always reads the same way, never randomized', () => {
    expect(pickMilestoneMessage('run', 25)).toBe(pickMilestoneMessage('run', 25));
  });
});
