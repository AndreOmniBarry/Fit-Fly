// A simple, standard 4-week mesocycle: three weeks of progressive
// overload, then a deload week at reduced volume — not a novel scheme,
// just the well-established beginner/intermediate default. weekNumber is
// 1-based and absolute (week 1 of the whole program), so this keeps
// working correctly across back-to-back mesocycles without the caller
// having to track "which block am I in" itself.

const BLOCK_LENGTH_WEEKS = 4;
const DELOAD_WEEK_IN_BLOCK = 4;

// Small week-over-week load bump within a block, then a lighter deload —
// applied to working weight/effort, not to the sets/reps prescription
// itself (that's varied separately, see program-generator.js).
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
