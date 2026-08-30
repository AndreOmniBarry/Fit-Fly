// Every generated day gets a warm-up and cooldown — never just the
// working sets. Two fixed tiers: 'gentle' (rehab-recuperation and
// sedentary-start — nothing ballistic, nothing that assumes a base
// level of conditioning) and 'standard' (everyone else). Content is
// static and hand-written on purpose, the same way the exercise
// library is — no generated/randomized cues here.

const GENTLE_CATEGORIES = new Set(['rehab-recuperation', 'sedentary-start']);

const WARMUP = Object.freeze({
  gentle: [
    '3-5 minutes of easy marching in place or a slow walk',
    'Arm circles, 10 each direction',
    'Gentle hip circles, 5 each direction',
  ],
  standard: [
    '3-5 minutes of light cardio (easy pace) to raise your heart rate',
    'Bodyweight squats x10, slow and controlled',
    'Arm circles and leg swings, a few each direction',
  ],
});

const COOLDOWN = Object.freeze({
  gentle: [
    'Slow walking for 2-3 minutes to bring your heart rate down',
    'Gentle full-body stretching, holding each stretch 20-30 seconds',
  ],
  standard: [
    '2-3 minutes of easy walking to bring your heart rate down',
    'Stretch the muscles you just trained, holding each 20-30 seconds',
  ],
});

function tierForCategory(category) {
  return GENTLE_CATEGORIES.has(category) ? 'gentle' : 'standard';
}

export function getWarmup(category) {
  return WARMUP[tierForCategory(category)];
}

export function getCooldown(category) {
  return COOLDOWN[tierForCategory(category)];
}
