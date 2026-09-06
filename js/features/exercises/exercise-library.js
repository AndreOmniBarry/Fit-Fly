// The built-in exercise library. Small and curated on purpose — every
// entry earns its place by covering a distinct movement pattern at a
// distinct difficulty/equipment combination, which is what
// js/features/programs/program-generator.js selects against. Demo art
// is never hand-authored per exercise here — see
// js/features/exercises/movement-category.js and movement-demo-svg.js:
// a per-exercise SVG doesn't scale to a growing library, so every
// exercise instead resolves (from its own `pattern`/`logMetric`
// metadata) onto one of a small set of reusable, looping animated demos
// keyed by movement category.

export const MOVEMENT_PATTERNS = Object.freeze([
  'squat',
  'hinge',
  'push',
  'pull',
  'core',
  'cardio',
  'mobility',
]);

export const EQUIPMENT = Object.freeze(['bodyweight', 'dumbbell']);
export const DIFFICULTY = Object.freeze(['beginner', 'intermediate', 'advanced']);

// What a logged set of this exercise actually measures — the Programs
// screen (js/features/programs/program-view.js) renders a different
// prescription and log form for each, instead of the same "reps + kg"
// pair for everything regardless of whether either one means anything:
//   - 'reps-weight': a loaded lift — reps *and* a real weight (kg),
//     feeds the estimated-1RM readout (only equipment: 'dumbbell'
//     exercises qualify; there's no meaningful "kg" for your own
//     bodyweight, so bodyweight moves never get this).
//   - 'reps': a bodyweight movement counted in reps — no weight field,
//     and no 1RM estimate (there's nothing to estimate a max of).
//   - 'hold': a static isometric hold — logged as seconds held, not
//     reps ("30 reps of plank" isn't a thing). Genuinely different from
//     'cardio' below even though both are seconds under the hood: a
//     hold prescribes a short, near-maximal-tension duration (see
//     program-generator.js's holdSec), a cardio bout a longer,
//     sub-maximal one (its own cardioSec) — collapsing the two into one
//     "time" metric (as this library used to) hid that real difference.
//   - 'cardio': a dynamic, rhythmic cardio bout — logged as seconds
//     *and*, optionally, a real distance in km for anything actually
//     covering ground (a brisk walk/jog); stationary cardio (marching
//     in place, jumping jacks) simply leaves distance blank rather than
//     a fabricated 0, the same "honest absence, not a fake value" rule
//     every other optional field in this app follows.
export const LOG_METRIC = Object.freeze(['reps-weight', 'reps', 'hold', 'cardio']);

export const EXERCISE_LIBRARY = Object.freeze([
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    pattern: 'squat',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'reps',
    cues: ['Feet shoulder-width apart', 'Sit hips back and down', 'Keep your chest up'],
    contraindications: ['knee'],
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    pattern: 'squat',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'dumbbell',
    difficulty: 'intermediate',
    logMetric: 'reps-weight',
    cues: ['Hold the weight close to your chest', 'Elbows track inside your knees'],
    contraindications: ['knee', 'wrist'],
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    pattern: 'push',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'reps',
    cues: ['Body in a straight line', 'Lower until your chest nears the floor', 'Drop to your knees any time it helps'],
    contraindications: ['wrist', 'shoulder'],
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    pattern: 'push',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    equipment: 'dumbbell',
    difficulty: 'intermediate',
    logMetric: 'reps-weight',
    cues: ['Press straight up over your chest', 'Keep a slight arch, feet planted'],
    contraindications: ['shoulder', 'wrist'],
  },
  {
    id: 'bent-over-row',
    name: 'Bent-Over Dumbbell Row',
    pattern: 'pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'dumbbell',
    difficulty: 'intermediate',
    logMetric: 'reps-weight',
    cues: ['Hinge forward, flat back', 'Pull the weight to your ribs'],
    contraindications: ['lower-back', 'shoulder'],
  },
  {
    id: 'inverted-row',
    name: 'Inverted Row',
    pattern: 'pull',
    muscleGroups: ['back', 'biceps'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'reps',
    cues: ['Use a sturdy bar or table edge', 'Pull your chest toward it, body straight'],
    contraindications: ['shoulder'],
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    pattern: 'hinge',
    muscleGroups: ['glutes', 'hamstrings'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'reps',
    cues: ['Feet flat, knees bent', 'Squeeze your glutes at the top'],
    contraindications: [],
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    pattern: 'hinge',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    equipment: 'dumbbell',
    difficulty: 'intermediate',
    logMetric: 'reps-weight',
    cues: ['Hinge at the hips, soft knees', 'Weight stays close to your legs'],
    contraindications: ['lower-back'],
  },
  {
    id: 'plank',
    name: 'Plank',
    pattern: 'core',
    muscleGroups: ['core'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'hold',
    cues: ['Straight line from head to heels', 'Brace like someone\'s about to poke your stomach'],
    contraindications: ['shoulder', 'wrist'],
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    pattern: 'core',
    muscleGroups: ['core'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'reps',
    cues: ['Lower back stays flat on the floor', 'Move opposite arm and leg together, slowly'],
    contraindications: [],
  },
  {
    id: 'standing-march',
    name: 'Standing March',
    pattern: 'cardio',
    muscleGroups: ['full-body'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'cardio',
    cues: ['Lift your knees to hip height', 'Swing your arms, steady breathing'],
    contraindications: ['knee', 'hip'],
  },
  {
    id: 'bodyweight-lunge',
    name: 'Bodyweight Lunge',
    pattern: 'squat',
    muscleGroups: ['quads', 'glutes'],
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    logMetric: 'reps',
    cues: ['Step forward, both knees to ~90°', 'Push back through your front heel'],
    contraindications: ['knee', 'ankle'],
  },
  // ---- cardio: more than one candidate per difficulty tier, so a
  // months-long endurance/fat-loss program's cardio days actually vary
  // instead of repeating Standing March forever (see program-
  // generator.js's block-rotation comment). Brisk Walk/Jog is the one
  // entry that genuinely covers ground, so it's the one that gets a
  // real distanceKm field alongside its duration.
  {
    id: 'brisk-walk-jog',
    name: 'Brisk Walk / Light Jog',
    pattern: 'cardio',
    muscleGroups: ['full-body'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'cardio',
    distanceTrackable: true,
    cues: ['Pick a pace you can hold the whole time', 'Land softly, relaxed shoulders'],
    contraindications: ['knee', 'ankle'],
  },
  {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    pattern: 'cardio',
    muscleGroups: ['full-body'],
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    logMetric: 'cardio',
    cues: ['Land soft, knees soft', 'Full arm swing overhead'],
    contraindications: ['knee', 'ankle', 'shoulder'],
  },
  {
    id: 'high-knees',
    name: 'High Knees',
    pattern: 'cardio',
    muscleGroups: ['full-body'],
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    logMetric: 'cardio',
    cues: ['Drive knees up fast, stay light on your feet', 'Quick, steady rhythm'],
    contraindications: ['knee', 'hip', 'ankle'],
  },
  // ---- mobility: real stretch/mobility-pattern work, distinct from a
  // strength pattern relabeled — see PATTERN_SEQUENCE_BY_DAY_TYPE in
  // program-generator.js, where a 'mobility' day type now actually pulls
  // from this pattern instead of borrowing core/hinge/cardio slots.
  {
    id: 'cat-cow-stretch',
    name: 'Cat-Cow Stretch',
    pattern: 'mobility',
    muscleGroups: ['back', 'core'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'hold',
    cues: ['Hands under shoulders, knees under hips', 'Flow slowly between arching and rounding your back'],
    contraindications: ['wrist'],
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Kneeling Hip Flexor Stretch',
    pattern: 'mobility',
    muscleGroups: ['hips', 'quads'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'hold',
    cues: ['Half-kneeling, back knee down on something soft', 'Tuck your hips under until you feel a gentle stretch up front'],
    contraindications: ['knee', 'hip'],
  },
  {
    id: 'thoracic-rotation-stretch',
    name: 'Open-Book Thoracic Rotation',
    pattern: 'mobility',
    muscleGroups: ['back', 'shoulders'],
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    logMetric: 'hold',
    cues: ['Lie on your side, knees stacked and bent', 'Open your top arm across your body, following it with your eyes'],
    contraindications: ['shoulder'],
  },
]);

const BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function getLibraryExercise(id) {
  return BY_ID.get(id);
}
