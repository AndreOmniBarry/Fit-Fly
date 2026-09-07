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

export const STREAK_RISK_PHRASES = Object.freeze({
  walk: [
    "Don't let your walk streak nap today — a short stroll keeps it alive.",
    'Your walking streak is one skipped day from resetting to zero.',
    "Time to smash your walk streak — lace up before the day gets away.",
  ],
  run: [
    "Your run streak is on the line — even a short shakeout run keeps it going.",
    'One more run today and your streak lives to fight another day.',
    "Time to smash your run streak before it slips.",
  ],
  hydration: [
    "Your hydration streak's about to run dry — a few glasses keeps it flowing.",
    "Don't let today be the day your water streak dries up.",
    'A quick glass of water now saves the whole streak.',
  ],
  sleep: [
    'Your sleep streak needs tonight logged to stay alive.',
    "One more good night keeps your sleep streak going strong.",
    "Don't let a great sleep streak slip — log tonight's.",
  ],
  strength: [
    'Your lifting streak is one session from breaking.',
    'Get under the bar today — your strength streak is counting on it.',
    "Time to smash your streak — one more session keeps it standing.",
  ],
  weight: [
    'Your check-in streak needs today logged to keep its momentum.',
    "Don't let today be the gap in an otherwise solid streak.",
    'A quick check-in today keeps your streak intact.',
  ],
  generic: [
    "Your streak is one day from breaking — a quick update saves it.",
    "Time to smash your streak before it resets to zero.",
    "Don't let today be the day the streak ends.",
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
