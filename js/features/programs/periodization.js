// A simple, standard 4-week mesocycle: three weeks of progressive
// overload, then a deload week at reduced volume — not a novel scheme,
// just the well-established beginner/intermediate default (linear
// periodization, e.g. the model described in the NSCA's Essentials of
// Strength Training and Conditioning: a short block of rising intensity
// followed by a planned lighter week to manage fatigue before the next
// block). weekNumber is 1-based and absolute (week 1 of the whole
// program), so this keeps working correctly across back-to-back
// mesocycles without the caller having to track "which block am I in"
// itself — a program never runs out of real content no matter how many
// months it's been going.

const BLOCK_LENGTH_WEEKS = 4;
const DELOAD_WEEK_IN_BLOCK = 4;

// Small week-over-week load bump within a block, then a lighter deload —
// applied to working weight/effort, not to the sets/reps prescription
// itself (that's varied separately, see program-generator.js).
// program-generator.js turns this into `targetLoadPercent` (a plain
// "aim for ~105%/~110% of week 1" number) on every generated exercise
// and its own reasoning line — this used to be computed and then never
// read by anything, which meant weeks 1-3 of a block were prescription-
// identical apart from the deload; it's real progressive overload now,
// not a flat repeat.
const WEEK_LOAD_MULTIPLIERS = Object.freeze({ 1: 1.0, 2: 1.05, 3: 1.1, 4: 0.6 });

export function getBlockInfo(weekNumber) {
  if (!(Number.isInteger(weekNumber) && weekNumber >= 1)) {
    throw new Error('weekNumber must be a positive integer');
  }
  const weekInBlock = ((weekNumber - 1) % BLOCK_LENGTH_WEEKS) + 1;
  const blockNumber = Math.floor((weekNumber - 1) / BLOCK_LENGTH_WEEKS) + 1;

  return {
    blockNumber,
    weekInBlock,
    isDeload: weekInBlock === DELOAD_WEEK_IN_BLOCK,
    loadMultiplier: WEEK_LOAD_MULTIPLIERS[weekInBlock],
  };
}
