// The category engine: a transparent, rule-based decision tree — not a
// black box — that places a person into exactly one of six categories.
// Every branch pushes a plain-language reason onto `reasoning`, which
// becomes the onboarding result screen's "why this" note. Safety branches
// are checked first and always win over a stated goal.

import { CATEGORIES } from '../../lib/theme.js';
import { classifyBmi } from './bmi.js';
import { hasRedFlags, SEVERITY } from './safety-screen.js';

export { CATEGORIES };

export const PRIMARY_GOALS = Object.freeze([
  'fat-loss',
  'build-muscle',
  'build-strength',
  'recomposition',
  'endurance',
  'rehab',
  'general-fitness',
]);

// Hypertrophy (bigger muscles) and strength (more force) are genuinely
// different training goals, not the same thing under two names — the
// NSCA's own guidelines put them in different rep/set/rest ranges
// (hypertrophy: ~6-12 reps, 3-4 sets, 60-90s rest; strength: ~1-6 reps,
// 3-5 sets, 2-5min rest). Both land in the same `hypertrophy` category
// (an upper/lower split fits either goal) with a `trainingFocus` tag
// that changes only the prescription — see program-generator.js's own
// STRENGTH_FOCUS_PRESCRIPTIONS. There's no separate "weight gain"
// primary goal here on purpose: whether muscle-building happens in a
// calorie surplus, deficit, or maintenance changes what Nutrition
// recommends, not what the training program itself looks like — that's
// a real, evidence-based reason, not an oversight (see "Tailored
// programs" in the README).
export const TRAINING_FOCUS = Object.freeze(['hypertrophy', 'strength']);

export const EXPERIENCE_LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);

/** A person training 0-1 days/week as a self-described beginner is
 *  deconditioned enough that jumping straight into a goal-driven program
 *  (even a gentle one) risks injury and burnout — build the base first. */
const SEDENTARY_START_MAX_WEEKLY_ACTIVE_DAYS = 1;

/** BMI on its own never decides a category, but for someone with no
 *  strong stated goal ('general-fitness'), it nudges the balanced default
 *  toward a fat-loss orientation when appropriate. */
const GENERAL_FITNESS_BMI_FAT_LOSS_NUDGE = 30; // classifyBmi() 'well-above-typical'

/**
 * @param {object} input
 * @param {string} input.primaryGoal - one of PRIMARY_GOALS
 * @param {number} input.weeklyActiveDays - self-reported current days/week of exercise
 * @param {string} input.experienceLevel - one of EXPERIENCE_LEVELS
 * @param {boolean} [input.hasCurrentInjuryOrPain]
 * @param {number} [input.injurySeverity] - SEVERITY.MILD/MODERATE/SEVERE, present only if hasCurrentInjuryOrPain
 * @param {string[]} [input.redFlagSymptomIds] - selections from safety-screen.js's RED_FLAG_SYMPTOMS
 * @param {number|null} [input.bmi]
 * @returns {{category: string, reasoning: string[], needsProfessionalReview: boolean, trainingFocus: 'hypertrophy'|'strength'|null}}
 */
export function assignCategory(input) {
  const {
    primaryGoal,
    weeklyActiveDays,
    experienceLevel,
    hasCurrentInjuryOrPain = false,
    injurySeverity = null,
    redFlagSymptomIds = [],
    bmi = null,
  } = input;

  const reasoning = [];
  const needsProfessionalReview = hasRedFlags(redFlagSymptomIds);
  if (needsProfessionalReview) {
    reasoning.push(
      'A couple of your answers are worth checking with a doctor or physical therapist before you start — see the note below.'
    );
  }

  // ---- safety first: overrides any stated goal ----
  const significantCurrentInjury =
    hasCurrentInjuryOrPain && injurySeverity >= SEVERITY.MODERATE;
  if (primaryGoal === 'rehab' || significantCurrentInjury || needsProfessionalReview) {
    reasoning.push(
      significantCurrentInjury || needsProfessionalReview
        ? 'You flagged something that needs care right now, so everything starts gentle and focused on recovering safely.'
        : 'You told us you\'re coming back from an injury, so everything starts gentle and focused on recovering safely.'
    );
    return { category: 'rehab-recuperation', reasoning, needsProfessionalReview, trainingFocus: null };
  }

  // ---- very deconditioned: build the base first, whatever the aspirational goal ----
  if (weeklyActiveDays <= SEDENTARY_START_MAX_WEEKLY_ACTIVE_DAYS && experienceLevel === 'beginner') {
    reasoning.push(
      `You're currently active about ${weeklyActiveDays} day(s) a week — we'll spend the first few weeks building a` +
        ' consistent habit and base fitness before layering on anything more demanding.'
    );
    return { category: 'sedentary-start', reasoning, needsProfessionalReview, trainingFocus: null };
  }

  // ---- otherwise, route by stated goal ----
  switch (primaryGoal) {
    case 'fat-loss':
      reasoning.push('Fat loss is your stated goal, so your program leans on a calorie deficit plus strength work to preserve muscle.');
      return { category: 'cut-fat-loss', reasoning, needsProfessionalReview, trainingFocus: null };

    case 'build-muscle':
      reasoning.push('Building muscle is your stated goal, so your program centers on progressive overload and recovery — moderate reps, moderate rest, the range with the most direct evidence for muscle growth.');
      return { category: 'hypertrophy', reasoning, needsProfessionalReview, trainingFocus: 'hypertrophy' };

    case 'build-strength':
      reasoning.push('Building strength is your stated goal — a genuinely different rep range from building muscle (lower reps, heavier intent, longer rest between sets), not the same program relabeled.');
      return { category: 'hypertrophy', reasoning, needsProfessionalReview, trainingFocus: 'strength' };

    case 'recomposition':
      reasoning.push('You want to build muscle and lose fat at the same time, so your program balances strength work with a modest calorie approach.');
      return { category: 'recomposition', reasoning, needsProfessionalReview, trainingFocus: null };

    case 'endurance':
      reasoning.push('Endurance is your stated goal, so your program builds aerobic base first, then adds intensity.');
      return { category: 'endurance', reasoning, needsProfessionalReview, trainingFocus: null };

    case 'general-fitness':
    default: {
      const bmiClass = classifyBmi(bmi);
      if (bmiClass === 'well-above-typical' || (bmi != null && bmi >= GENERAL_FITNESS_BMI_FAT_LOSS_NUDGE)) {
        reasoning.push('You didn\'t pick a specific goal, so we started you with a fat-loss lean based on your profile — easy to change any time.');
        return { category: 'cut-fat-loss', reasoning, needsProfessionalReview, trainingFocus: null };
      }
      reasoning.push('You didn\'t pick a specific goal, so we started you with a balanced mix of strength and moderate cardio — easy to change any time.');
      return { category: 'recomposition', reasoning, needsProfessionalReview, trainingFocus: null };
    }
  }
}
