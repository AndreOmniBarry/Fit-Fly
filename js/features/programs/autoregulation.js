// Set-level Reps-in-Reserve (RIR) autoregulation for Programs' own
// reps-*range* prescriptions. program-generator.js never prescribes an
// absolute target weight — a person always picks their own load each
// time they log a set (see that file's own doc comment) — so classic
// RPE-driven weight-*percentage* autoregulation doesn't map onto this
// app at all. What does map, and is real, well-established sports
// science: capturing a person's own honest RIR per logged set, then
// using their own recent real numbers to suggest whether their *next*
// set (or next session) of that same exercise should probably go a
// little heavier, hold steady, or ease off — never a weight-percentage
// target this app never prescribed in the first place.
//
// Real citation: Zourdos MC, Klemp A, Dolan C, Quiles JM, Schau KA, Jo E,
// Helms E, Esformes JI, Bazyler C, Blanco R. "Novel Resistance
// Training-Specific Rating of Perceived Exertion Scale Measuring
// Repetitions in Reserve." J Strength Cond Res. 2016;30(1):267-275.
// Validated an RPE 1-10 scale anchored to real reps-in-reserve:
// RPE 10 = 0 RIR (a set taken to genuine muscular failure), RPE 9 = 1
// RIR, RPE 8 = 2 RIR, RPE 7 = 3 RIR, RPE 5-6 = grouped as roughly 4-6
// RIR (people reliably distinguish RIR only up to about 3-4 in reserve,
// per the paper's own descriptor table) — exactly why this feature's own
// UI (program-view.js) groups everything from 4 RIR up into a single
// "4+" option, rather than pretending to a false precision beyond it.
// Secondary source, same scale, more applied framing: Helms ER,
// Cronin J, Storey A, Zourdos MC. "Application of the Repetitions in
// Reserve-Based Rating of Perceived Exertion Scale for Resistance
// Training." Strength Cond J. 2016;38(4):42-49 (PMC4961270).
//
// Honesty note — read before changing this file: this is NOT the
// validated scale's own clinical/coaching protocol (a real program built
// around it prescribes a target RIR per week of a training block, and
// expects a coach reading bar-speed/movement quality alongside the
// number). This module is this app's own, much smaller, honest
// application of the scale's real core insight — a consistently high
// self-reported RIR means real room was genuinely left on the table; a
// consistently ~0 RIR means a set is running right up to (or past) a
// sustainable effort — to this app's own reps-*range* prescriptions. It
// never estimates a 1RM, never invents a percentage, and never predicts
// anything beyond "your own recent, real, self-reported numbers for this
// exercise point this way" — a suggestion, never an instruction, the
// same tone as js/features/recovery/readiness.js's own
// readinessActionSuggestion: the actual decision always stays with the
// person.

// How many of a person's most recent RIR-tagged sets for one exercise
// this looks at. Small on purpose — a "next set/session" suggestion
// should track someone's *current* pattern, not average in effort from
// weeks ago that may no longer reflect how this exercise feels today.
const RECENT_WINDOW_SIZE = 3;

// A set only has something real to say here if it was both genuinely
// loaded (a real external weight, not a bodyweight/0kg placeholder) and
// actually RIR-tagged — matching program-view.js, which only ever offers
// the RIR picker on a just-logged reps-weight set in the first place.
function isRirTaggedLoadedSet(set) {
  return set != null && Number.isFinite(set.rir) && set.weightKg > 0;
}

// 'high' (real room left, >= 3 RIR), 'low' (at or just above failure,
// <= 1 RIR), or 'mid' (2 RIR) — the three real buckets a suggestion can
// be confidently built from. Anything that isn't uniform across the
// recent window is honestly reported as 'mixed' (see
// suggestNextLoadAdjustment below) rather than averaged into a single
// number that implies more confidence than the actual pattern supports.
function bucketFor(rir) {
  if (rir >= 3) return 'high';
  if (rir <= 1) return 'low';
  return 'mid';
}

export const AUTOREGULATION_DIRECTION = Object.freeze({
  HEAVIER: 'heavier',
  HOLD: 'hold',
  EASE: 'ease',
  MIXED: 'mixed',
});

function messageFor(direction, count, averageRir) {
  const setWord = count === 1 ? 'set' : 'sets';
  switch (direction) {
    case AUTOREGULATION_DIRECTION.HEAVIER:
      return `Your last ${count} RIR-tagged ${setWord} of this exercise had real room left (avg ${averageRir} reps in reserve) — worth trying a bit heavier next time, if it feels right.`;
    case AUTOREGULATION_DIRECTION.EASE:
      return `Your last ${count} RIR-tagged ${setWord} of this exercise ran right up to (or past) your limit — worth holding steady, or easing off slightly next time, rather than pushing heavier.`;
    case AUTOREGULATION_DIRECTION.HOLD:
      return `Your last ${count} RIR-tagged ${setWord} of this exercise landed around a moderate effort — about right to hold steady next time.`;
    case AUTOREGULATION_DIRECTION.MIXED:
      return `Your last ${count} RIR-tagged ${setWord} of this exercise swung between quite different efforts — not a clear enough pattern to suggest a direction here, go by feel.`;
    default:
      return '';
  }
}

/**
 * A real, honest next-set/next-session suggestion for one exercise, built
 * only from that exercise's own recently logged, RIR-tagged sets — never
 * a fabricated default, never an instruction. See this module's own doc
 * comment for the real citation and exactly what is/isn't implemented
 * here.
 *
 * @param {{reps?: number, weightKg?: number, rir?: number|null, completedAt: string}[]} recentSets -
 *   every logged set for one exercise, in any order (see
 *   js/db/repositories/sessions.js's listSetsForExercise, which already
 *   returns them most-recent-first — this re-sorts defensively rather
 *   than trusting caller order). Only sets that are both really loaded
 *   (`weightKg > 0`) and really RIR-tagged (`rir` a finite number) count;
 *   everything else (bodyweight sets, untagged sets) is ignored, not
 *   treated as a 0.
 * @returns {{direction: 'heavier'|'hold'|'ease'|'mixed', message: string,
 *   basedOnSetCount: number, averageRir: number}|null} null when there is
 *   no real RIR-tagged, loaded set for this exercise yet — no data means
 *   no suggestion, never a fabricated one.
 */
export function suggestNextLoadAdjustment(recentSets) {
  if (!Array.isArray(recentSets)) return null;

  const tagged = recentSets
    .filter(isRirTaggedLoadedSet)
    .slice()
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, RECENT_WINDOW_SIZE);

  if (tagged.length === 0) return null;

  const buckets = tagged.map((set) => bucketFor(set.rir));
  const uniform = buckets.every((bucket) => bucket === buckets[0]);
  const averageRir = Math.round((tagged.reduce((sum, set) => sum + set.rir, 0) / tagged.length) * 10) / 10;

  const direction = !uniform
    ? AUTOREGULATION_DIRECTION.MIXED
    : buckets[0] === 'high'
      ? AUTOREGULATION_DIRECTION.HEAVIER
      : buckets[0] === 'low'
        ? AUTOREGULATION_DIRECTION.EASE
        : AUTOREGULATION_DIRECTION.HOLD;

  return {
    direction,
    message: messageFor(direction, tagged.length, averageRir),
    basedOnSetCount: tagged.length,
    averageRir,
  };
}
