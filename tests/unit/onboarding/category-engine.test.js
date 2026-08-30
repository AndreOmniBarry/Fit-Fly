import { describe, expect, it } from 'vitest';
import { assignCategory, CATEGORIES } from '../../../js/features/onboarding/category-engine.js';
import { SEVERITY } from '../../../js/features/onboarding/safety-screen.js';

const CONDITIONED_ADULT = {
  weeklyActiveDays: 4,
  experienceLevel: 'intermediate',
  hasCurrentInjuryOrPain: false,
  redFlagSymptomIds: [],
  bmi: 23,
};

describe('assignCategory: goal routing for an otherwise-healthy, conditioned person', () => {
  it.each([
    ['fat-loss', 'cut-fat-loss'],
    ['build-muscle', 'hypertrophy'],
    ['recomposition', 'recomposition'],
    ['endurance', 'endurance'],
  ])('%s -> %s', (primaryGoal, expectedCategory) => {
    const result = assignCategory({ ...CONDITIONED_ADULT, primaryGoal });
    expect(result.category).toBe(expectedCategory);
    expect(result.needsProfessionalReview).toBe(false);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('general-fitness with a typical BMI lands on the balanced default', () => {
    const result = assignCategory({ ...CONDITIONED_ADULT, primaryGoal: 'general-fitness', bmi: 23 });
    expect(result.category).toBe('recomposition');
  });

  it('general-fitness with a well-above-typical BMI nudges toward fat loss', () => {
    const result = assignCategory({ ...CONDITIONED_ADULT, primaryGoal: 'general-fitness', bmi: 33 });
    expect(result.category).toBe('cut-fat-loss');
  });
});

describe('assignCategory: safety overrides beat any stated goal', () => {
  it('primaryGoal "rehab" always lands on rehab-recuperation', () => {
    const result = assignCategory({ ...CONDITIONED_ADULT, primaryGoal: 'rehab' });
    expect(result.category).toBe('rehab-recuperation');
  });

  it('a moderate or worse current injury overrides a fat-loss/hypertrophy goal', () => {
    const result = assignCategory({
      ...CONDITIONED_ADULT,
      primaryGoal: 'build-muscle',
      hasCurrentInjuryOrPain: true,
      injurySeverity: SEVERITY.MODERATE,
    });
    expect(result.category).toBe('rehab-recuperation');
  });

  it('a mild current injury does NOT override the stated goal', () => {
    const result = assignCategory({
      ...CONDITIONED_ADULT,
      primaryGoal: 'build-muscle',
      hasCurrentInjuryOrPain: true,
      injurySeverity: SEVERITY.MILD,
    });
    expect(result.category).toBe('hypertrophy');
  });

  it('any red flag overrides the stated goal and flags for professional review', () => {
    const result = assignCategory({
      ...CONDITIONED_ADULT,
      primaryGoal: 'endurance',
      redFlagSymptomIds: ['chest-pain-pressure'],
    });
    expect(result.category).toBe('rehab-recuperation');
    expect(result.needsProfessionalReview).toBe(true);
    expect(result.reasoning[0]).toMatch(/doctor|physical therapist/i);
  });
});

describe('assignCategory: deconditioned beginners get sedentary-start first', () => {
  it('0-1 active days/week + beginner experience overrides an aspirational goal', () => {
    const result = assignCategory({
      ...CONDITIONED_ADULT,
      primaryGoal: 'build-muscle',
      weeklyActiveDays: 0,
      experienceLevel: 'beginner',
    });
    expect(result.category).toBe('sedentary-start');
  });

  it('a beginner who is already active 2+ days/week is NOT routed to sedentary-start', () => {
    const result = assignCategory({
      ...CONDITIONED_ADULT,
      primaryGoal: 'build-muscle',
      weeklyActiveDays: 2,
      experienceLevel: 'beginner',
    });
    expect(result.category).toBe('hypertrophy');
  });

  it('an intermediate/advanced person training 0-1 days/week is NOT routed to sedentary-start', () => {
    // Low current days doesn't necessarily mean deconditioned if they have
    // real training history — e.g. returning from a busy stretch.
    const result = assignCategory({
      ...CONDITIONED_ADULT,
      primaryGoal: 'build-muscle',
      weeklyActiveDays: 1,
      experienceLevel: 'advanced',
    });
    expect(result.category).toBe('hypertrophy');
  });
});

describe('precedence: safety beats deconditioned-beginner beats goal', () => {
  it('a red flag wins even for a deconditioned beginner', () => {
    const result = assignCategory({
      primaryGoal: 'build-muscle',
      weeklyActiveDays: 0,
      experienceLevel: 'beginner',
      redFlagSymptomIds: ['dizziness-fainting'],
    });
    expect(result.category).toBe('rehab-recuperation');
    expect(result.needsProfessionalReview).toBe(true);
  });
});

describe('CATEGORIES', () => {
  it('every category assignCategory can return is a valid category', () => {
    expect(CATEGORIES).toContain('sedentary-start');
    expect(CATEGORIES).toContain('cut-fat-loss');
    expect(CATEGORIES).toContain('recomposition');
    expect(CATEGORIES).toContain('rehab-recuperation');
    expect(CATEGORIES).toContain('hypertrophy');
    expect(CATEGORIES).toContain('endurance');
    expect(CATEGORIES).toHaveLength(6);
  });
});
