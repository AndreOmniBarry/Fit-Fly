// The built-in exercise library. Small and curated on purpose — every
// entry earns its place by covering a distinct movement pattern at a
// distinct difficulty/equipment combination, which is what
// js/features/programs/program-generator.js selects against. Each has a
// hand-authored demo SVG under assets/exercise-svgs/.

export const MOVEMENT_PATTERNS = Object.freeze([
  'squat',
  'hinge',
  'push',
  'pull',
  'core',
  'cardio',
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
//   - 'time': an isometric hold or a timed cardio bout — logged as
//     seconds held, not reps at all ("30 reps of plank" isn't a thing).
export const LOG_METRIC = Object.freeze(['reps-weight', 'reps', 'time']);

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
    demoSvg: 'assets/exercise-svgs/bodyweight-squat.svg',
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
    demoSvg: 'assets/exercise-svgs/goblet-squat.svg',
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
    demoSvg: 'assets/exercise-svgs/push-up.svg',
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
    demoSvg: 'assets/exercise-svgs/dumbbell-bench-press.svg',
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
    demoSvg: 'assets/exercise-svgs/bent-over-row.svg',
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
    demoSvg: 'assets/exercise-svgs/inverted-row.svg',
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
    demoSvg: 'assets/exercise-svgs/glute-bridge.svg',
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
    demoSvg: 'assets/exercise-svgs/romanian-deadlift.svg',
  },
  {
    id: 'plank',
    name: 'Plank',
    pattern: 'core',
    muscleGroups: ['core'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'time',
    cues: ['Straight line from head to heels', 'Brace like someone\'s about to poke your stomach'],
    contraindications: ['shoulder', 'wrist'],
    demoSvg: 'assets/exercise-svgs/plank.svg',
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
    demoSvg: 'assets/exercise-svgs/dead-bug.svg',
  },
  {
    id: 'standing-march',
    name: 'Standing March',
    pattern: 'cardio',
    muscleGroups: ['full-body'],
    equipment: 'bodyweight',
    difficulty: 'beginner',
    logMetric: 'time',
    cues: ['Lift your knees to hip height', 'Swing your arms, steady breathing'],
    contraindications: ['knee', 'hip'],
    demoSvg: 'assets/exercise-svgs/standing-march.svg',
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
    demoSvg: 'assets/exercise-svgs/bodyweight-lunge.svg',
  },
]);

const BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function getLibraryExercise(id) {
  return BY_ID.get(id);
}
