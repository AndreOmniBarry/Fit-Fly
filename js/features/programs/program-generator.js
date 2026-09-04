// Turns a category + experience level + any flagged injury areas into a
// concrete week of training — which exercises, how many sets/reps, how
// much rest — plus a plain-language reason for the shape of it. Fully
// deterministic (same inputs -> same program) so it's testable without
// randomness, and so "why this" reasoning can point at real, reproducible
// choices rather than a black box.

import { EXERCISE_LIBRARY } from '../exercises/exercise-library.js';
import { getBlockInfo } from './periodization.js';
import { getCooldown, getWarmup } from './warmup-cooldown.js';

const DIFFICULTY_ALLOWANCE = Object.freeze({
  beginner: ['beginner'],
  intermediate: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'],
});

/** Which movement patterns, in order, fill each day type. A pattern can
 *  repeat (e.g. two 'push' slots on an upper day) for extra volume — the
 *  picker below just skips a repeat slot if the library has no second
 *  distinct exercise for it, rather than erroring. */
const PATTERN_SEQUENCE_BY_DAY_TYPE = Object.freeze({
  'full-body': ['squat', 'push', 'pull', 'core'],
  upper: ['push', 'pull', 'push', 'pull'],
  lower: ['squat', 'hinge', 'core'],
  cardio: ['cardio'],
  mobility: ['core', 'hinge', 'cardio'],
});

const CATEGORY_DAY_PLANS = Object.freeze({
  'sedentary-start': ['full-body', 'full-body'],
  'cut-fat-loss': ['full-body', 'cardio', 'full-body', 'cardio'],
  recomposition: ['upper', 'lower', 'upper', 'lower'],
  'rehab-recuperation': ['mobility', 'mobility', 'mobility'],
  hypertrophy: ['upper', 'lower', 'upper', 'lower'],
  endurance: ['cardio', 'full-body', 'cardio', 'full-body'],
});

// `holdSec` is the prescription for logMetric: 'time' exercises (plank,
// standing march) — there's no rep count for a timed hold, so this is a
// genuinely separate number from `reps`, not the same value relabeled.
// Roughly scaled to match each category's own reps range/intensity
// (a beginner plank hold starts short and builds up, same shape as a
// beginner's rep count — see exercise-library.js's own comment on why
// this needed splitting out from reps in the first place).
const CATEGORY_PRESCRIPTIONS = Object.freeze({
  'sedentary-start': { sets: 2, reps: '10-15', holdSec: '15-20', restSec: 60 },
  'cut-fat-loss': { sets: 3, reps: '12-15', holdSec: '20-30', restSec: 45 },
  recomposition: { sets: 3, reps: '8-12', holdSec: '20-30', restSec: 75 },
  'rehab-recuperation': { sets: 2, reps: '10-12', holdSec: '10-15', restSec: 60 },
  hypertrophy: { sets: 4, reps: '8-12', holdSec: '30-45', restSec: 90 },
  endurance: { sets: 2, reps: '15-20', holdSec: '30-45', restSec: 30 },
});

// A real strength-training prescription, per the NSCA's own guidelines —
// lower reps at heavier intent, more sets, meaningfully longer rest
// (2-5min for real neuromuscular recovery between near-maximal efforts,
// not the ~90s hypertrophy rest above) — this is what actually makes
// "build strength" a different program from "build muscle", not a
// re-skinned copy of it. Timed holds get proportionally longer too:
// a strength-focused isometric still aims for near-maximal tension, held
// briefly, not hypertrophy's longer time-under-tension.
const STRENGTH_FOCUS_PRESCRIPTION = Object.freeze({ sets: 5, reps: '3-6', holdSec: '20-30', restSec: 180 });

const CATEGORY_REASONING = Object.freeze({
  'sedentary-start': 'Two full-body sessions a week, light volume — building the habit and a base matters more than the exact numbers right now.',
  'cut-fat-loss': 'Full-body strength days keep your muscle while you\'re in a calorie deficit, with dedicated cardio days to help the deficit along.',
  recomposition: 'An upper/lower split gives enough strength volume to build muscle while cardio and diet handle the fat-loss side.',
  'rehab-recuperation': 'Everything here is deliberately gentle and low-load, focused on pain-free movement — this is not the time to chase numbers.',
  hypertrophy: 'An upper/lower split with higher volume and full rest between sets is the standard structure for building muscle.',
  endurance: 'Cardio-forward days build your aerobic base, with full-body strength days in between to support it.',
});

const STRENGTH_FOCUS_REASONING =
  'Same upper/lower split as hypertrophy, but a real strength prescription underneath it — lower reps at heavier intent, more sets, and meaningfully longer rest between them so each set can actually be near-maximal.';

function difficultyAllowanceFor(experienceLevel) {
  return DIFFICULTY_ALLOWANCE[experienceLevel] ?? DIFFICULTY_ALLOWANCE.beginner;
}

function candidatesForPattern(pattern, { experienceLevel, contraindicatedTags }) {
  const allowedDifficulties = difficultyAllowanceFor(experienceLevel);
  return EXERCISE_LIBRARY.filter(
    (exercise) =>
      exercise.pattern === pattern &&
      allowedDifficulties.includes(exercise.difficulty) &&
      !exercise.contraindications.some((tag) => contraindicatedTags.includes(tag))
  );
}

/** Deterministic: walks the pattern sequence in order, picking a safe/
 *  eligible exercise for each slot that isn't already used this day. A
 *  slot with nothing safe/eligible left is skipped, not errored — the
 *  day just ends up a little shorter.
 *
 *  Which candidate wins a slot rotates by `blockNumber` (each ~4-week
 *  mesocycle) rather than always the same first eligible one forever —
 *  real variety over a months-long plan instead of an identical program
 *  repeating block after block. Still fully deterministic: the same
 *  block always picks the same exercise, so a program is reproducible
 *  and testable, just not frozen in place across the whole plan. */
function pickExercisesForDay(patternSequence, opts) {
  const pickedIds = new Set();
  const picks = [];
  for (const pattern of patternSequence) {
    const candidates = candidatesForPattern(pattern, opts).filter((e) => !pickedIds.has(e.id));
    if (candidates.length === 0) continue;
    const candidate = candidates[(opts.blockNumber - 1) % candidates.length];
    pickedIds.add(candidate.id);
    picks.push(candidate);
  }
  return picks;
}

/**
 * @param {object} input
 * @param {string} input.category
 * @param {string} input.experienceLevel
 * @param {'hypertrophy'|'strength'|null} [input.trainingFocus] - only meaningful for category 'hypertrophy'; see category-engine.js
 * @param {string[]} [input.injuryBodyAreaTags] - tags from body-area-tag.js
 * @param {number} [input.weekNumber] - 1-based, absolute
 */
export function generateProgram({
  category,
  experienceLevel,
  trainingFocus = null,
  injuryBodyAreaTags = [],
  weekNumber = 1,
}) {
  const dayPlan = CATEGORY_DAY_PLANS[category];
  if (!dayPlan) throw new Error(`generateProgram: unknown category "${category}"`);

  const isStrengthFocus = category === 'hypertrophy' && trainingFocus === 'strength';
  const prescription = isStrengthFocus ? STRENGTH_FOCUS_PRESCRIPTION : CATEGORY_PRESCRIPTIONS[category];
  const block = getBlockInfo(weekNumber);
  const setsThisWeek = block.isDeload ? Math.max(1, prescription.sets - 1) : prescription.sets;

  const days = dayPlan.map((dayType, index) => {
    const exercises = pickExercisesForDay(PATTERN_SEQUENCE_BY_DAY_TYPE[dayType], {
      experienceLevel,
      contraindicatedTags: injuryBodyAreaTags,
      blockNumber: block.blockNumber,
    });
    return {
      dayIndex: index + 1,
      dayType,
      warmup: getWarmup(category),
      cooldown: getCooldown(category),
      exercises: exercises.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        logMetric: exercise.logMetric,
        sets: setsThisWeek,
        reps: prescription.reps,
        holdSec: prescription.holdSec,
        restSec: prescription.restSec,
      })),
    };
  });

  const reasoning = [isStrengthFocus ? STRENGTH_FOCUS_REASONING : CATEGORY_REASONING[category]];
  if (block.isDeload) {
    reasoning.push('This is a deload week — one fewer set across the board so you recover and come back stronger.');
  }
  if (injuryBodyAreaTags.length > 0) {
    reasoning.push(`Exercises that load your ${injuryBodyAreaTags.join(', ')} were left out this week.`);
  }
  if (block.blockNumber > 1) {
    reasoning.push(`Block ${block.blockNumber}: exercise selection rotated where a safe alternative exists, so months of training don't repeat the exact same movements forever.`);
  }

  return {
    category,
    // Normalized, not echoed verbatim: a stray trainingFocus passed
    // alongside a category it doesn't apply to would otherwise claim a
    // focus the program's actual prescription never used.
    trainingFocus: category === 'hypertrophy' ? trainingFocus : null,
    weekNumber,
    blockNumber: block.blockNumber,
    weekInBlock: block.weekInBlock,
    isDeload: block.isDeload,
    days,
    reasoning,
  };
}
