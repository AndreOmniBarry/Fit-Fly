// Turns a generated program week's flat "Day 1/2/3" list into a real,
// professional week-shaped schedule — a full 7-day strip with rest days
// shown explicitly, the shape every real fitness app's "My Program"
// screen already has, instead of only ever listing the 2-4 training
// days and leaving the rest of the week entirely unrepresented. Pure: no
// I/O, no Date.now() — every date comes from the program's own real
// start date plus a real week offset, so it's fully deterministic and
// testable against a fixed input.
//
// Deliberately separate from program-calendar.js's own "rest day" state
// (classifyProgramCalendarDay) — that one describes real logged history
// ("this program existed on this date and nothing was logged"), this one
// describes a forward-looking schedule ("this is which real weekday each
// of this week's training days falls on"). Assigning training days to
// fixed weekdays is a deliberate reversal of that module's own "never a
// fabricated scheduled Tuesday" stance — direct, explicit user feedback
// that a program with no visible week shape at all reads as unstructured
// and unprofessional next to a real fitness app is what earns that
// reversal here; program-calendar.js's own history view is untouched and
// still makes no such claim about the past.
//
// Still keeps using the program's own rolling week (week-number.js) —
// program start date + (weekNumber-1)*7 days — rather than realigning to
// a calendar Monday, so every date shown is still a real day of this
// actual program (whatever weekday it happened to start on), not a
// second, disconnected week concept layered on top of the first.

/** Which 0-based day-of-week offsets (within this program's own real
 *  7-day week) a given count of training days lands on — chosen to
 *  spread real rest between training rather than clustering every
 *  session at the front of the week. A count with no explicit entry
 *  (5, 6, 7 — no category currently prescribes this many, but a future
 *  one might) falls back to filling offsets 0, 1, 2, ... in order. */
const WEEKDAY_SLOTS_BY_COUNT = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * @param {string} programStartDateIso - local YYYY-MM-DD, this program's real start date
 * @param {number} weekNumber - 1-based, the same rolling week week-number.js computes
 * @param {object[]} days - generateProgram()'s own `days` array (2-4 entries)
 * @returns {{date: string, weekdayLabel: string, day: object|null}[]} exactly 7 entries,
 *   in this program's own real week order (not necessarily Monday-first)
 */
export function buildProgramWeekStrip(programStartDateIso, weekNumber, days) {
  const slots = WEEKDAY_SLOTS_BY_COUNT[days.length] ?? days.map((_, i) => i % 7);
  const dayByOffset = new Map();
  days.forEach((day, i) => {
    const offset = slots[i];
    if (offset != null) dayByOffset.set(offset, day);
  });

  const weekStart = new Date(`${programStartDateIso}T00:00:00`);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

  const result = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + offset);
    result.push({
      date: isoDate(d),
      weekdayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: dayByOffset.get(offset) ?? null,
    });
  }
  return result;
}
