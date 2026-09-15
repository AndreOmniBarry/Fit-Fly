// A real phrase bank for Goals notifications — catchy, activity-specific
// copy instead of one generic "you have a goal" line repeated for every
// person and every kind of goal. Every phrase here is only ever paired
// with a trigger that's true of real logged data (see reminders.js) —
// this module just picks the wording, it never decides *whether* to
// notify.
//
// 'generic' is the fallback for a goal goal-activity.js couldn't classify
// (a made-up unit, an ambiguous name) — plainer on purpose, since a wrong
// guess at "catchy" reads worse than an honest generic line.

import { MILESTONE_MESSAGES } from './milestones.js';

// Gain-framed, deliberately: real meta-analytic evidence finds gain-framed
// messages ("do this and gain X") outperform loss-framed ones ("do this or
// lose X") specifically for low-risk, maintenance-type behaviors — sleep,
// hydration, steps, exercise habits, all of what Goals actually covers
// (loss-framing's own edge shows up for high-risk detection behaviors like
// a cancer screening, not this). These phrases used to lean on "breaking,"
// "resetting to zero," "running dry," "slipping," "flatline" — real loss
// language for exactly the behaviors the evidence says respond better to
// the opposite framing. Rewritten around what logging today actually adds,
// not what skipping it would cost — see reminders.js's own body line for
// the same fix applied to the real streak number underneath the title.
export const STREAK_RISK_PHRASES = Object.freeze({
  walk: [
    'A short stroll today grows your walk streak by one more day.',
    'Log a walk today and keep building toward your longest streak yet.',
    "Lace up — today's walk adds another day to a real streak.",
  ],
  run: [
    'Even a short shakeout run extends your streak by one more day.',
    'One more run today and your streak grows again.',
    'A quick run today keeps your real momentum building.',
  ],
  hydration: [
    'A few glasses today extends your hydration streak by one more day.',
    'Log some water today and keep your streak growing.',
    'One more day logged, one more day added to your hydration streak.',
  ],
  sleep: [
    "Log tonight and your sleep streak grows to another good night.",
    'One more night logged extends your real sleep streak.',
    "Tonight's log adds another night to a streak that's already working.",
  ],
  strength: [
    'One more session today grows your lifting streak by a day.',
    'Get under the bar today and extend your real streak.',
    'A session today adds another day to your strength streak.',
  ],
  weight: [
    'A quick check-in today extends your streak by one more day.',
    "Log today and keep your check-in streak growing.",
    "Today's check-in adds another day to your real streak.",
  ],
  cardio: [
    'A session today extends your endurance streak by one more day.',
    'Get the heart rate up today and keep your streak building.',
    "One more session today, one more day added to a real streak.",
  ],
  skill: [
    'A quick technique session today extends your practice streak.',
    'One more rep session today adds a day to your skill streak.',
    "Today's practice grows a streak that's already paying off.",
  ],
  generic: [
    'A quick update today extends your streak by one more day.',
    'Log today and keep your real streak growing.',
    "Today's log adds another day to a streak that's already working.",
  ],
});

export const CLOSE_TO_TARGET_PHRASES = Object.freeze({
  walk: [
    "So close! A few more steps and that walk goal is history.",
    'Your walk goal is within reach — finish it off.',
    'Almost at your step target — one more push.',
  ],
  run: [
    "You're nearly there — that run goal is just around the corner.",
    'The finish line on your run goal is in sight.',
    'One more run and that distance goal is done.',
  ],
  hydration: [
    'A couple more glasses and your hydration goal is done for good.',
    "You're almost fully topped up on your water goal.",
    'Your hydration goal is nearly full — finish strong.',
  ],
  sleep: [
    'Your sleep goal is nearly banked — keep the streak of good nights going.',
    "You're almost there on your sleep goal.",
    'One more solid night and your sleep goal is met.',
  ],
  strength: [
    'Your lift is nearly at target — one more session could do it.',
    "You're closing in on that strength goal.",
    'That PR goal is within striking distance.',
  ],
  weight: [
    "You're almost at your target — stay the course.",
    'So close to your weight goal — keep it up.',
    'The last stretch of your weight goal is right here.',
  ],
  cardio: [
    'Your endurance goal is within striking distance — one more session.',
    "You're closing in on that cardio target.",
    'Nearly there on your endurance goal — keep the pace up.',
  ],
  skill: [
    "You're almost at that technique goal — a few more reps.",
    'Your skill goal is nearly locked in — keep practicing.',
    "So close on your practice goal — finish the set.",
  ],
  generic: [
    "So close! You're almost at this goal.",
    'Your goal is within reach — finish it off.',
    "You're nearly there — keep going.",
  ],
});

const MILESTONE_PHRASES = Object.freeze({
  walk: {
    25: 'A quarter of the way to your walk goal — keep stepping.',
    50: 'Halfway to your walk goal — great pace.',
    75: 'Almost at your walk goal — final stretch.',
  },
  run: {
    25: 'A quarter of your run goal banked.',
    50: 'Halfway to your run goal — keep the legs moving.',
    75: 'Three-quarters of your run goal done — almost there.',
  },
  hydration: {
    25: 'A quarter of the way to your hydration goal.',
    50: 'Halfway hydrated — keep sipping toward the goal.',
    75: 'Almost fully topped up on your hydration goal.',
  },
  sleep: {
    25: 'A quarter of the way to your sleep goal.',
    50: 'Halfway to your sleep goal — keep those good nights coming.',
    75: 'Almost at your sleep goal — a few more good nights to go.',
  },
  strength: {
    25: 'A quarter of the way to your lifting goal.',
    50: 'Halfway to your strength goal — keep loading the bar.',
    75: 'Almost at your strength goal — final sets.',
  },
  weight: {
    25: 'A quarter of the way to your weight goal.',
    50: 'Halfway to your weight goal — steady progress.',
    75: 'Almost at your weight goal — the finish line is close.',
  },
  cardio: {
    25: 'A quarter of the way to your endurance goal.',
    50: 'Halfway to your cardio goal — engine\'s warming up.',
    75: 'Three-quarters of your endurance goal done — keep pushing.',
  },
  skill: {
    25: 'A quarter of the way to your practice goal.',
    50: 'Halfway to your skill goal — the reps are adding up.',
    75: 'Almost at your skill goal — final reps.',
  },
});

/** Picks one phrase from a list — `random` is injectable so callers can
 *  get a deterministic pick in tests (e.g. `() => 0` always picks the
 *  first) instead of this reaching for real randomness itself. */
export function pickPhrase(phrases, random = Math.random) {
  const index = Math.floor(random() * phrases.length);
  return phrases[Math.min(index, phrases.length - 1)];
}

/** The milestone line for a real crossed threshold — activity-flavored
 *  when this goal's type has its own copy, otherwise the same plain
 *  MILESTONE_MESSAGES every goal used before activity-specific copy
 *  existed. Never random: a given threshold always reads the same way,
 *  same as the plain messages it replaces. */
export function pickMilestoneMessage(activityType, threshold) {
  return MILESTONE_PHRASES[activityType]?.[threshold] ?? MILESTONE_MESSAGES[threshold];
}
