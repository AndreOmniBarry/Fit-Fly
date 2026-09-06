export const FLOW_LEVELS = Object.freeze(['none', 'spotting', 'light', 'medium', 'heavy']);

export const SYMPTOMS = Object.freeze([
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'mood-swings', label: 'Mood swings' },
  { id: 'tender-breasts', label: 'Tender breasts' },
  { id: 'acne', label: 'Acne' },
  { id: 'backache', label: 'Backache' },
]);

export const MOODS = Object.freeze([
  { id: 'great', label: 'Great' },
  { id: 'good', label: 'Good' },
  { id: 'okay', label: 'Okay' },
  { id: 'low', label: 'Low' },
  { id: 'irritable', label: 'Irritable' },
]);

/** A logged day counts as a period *start* if it has real flow and
 *  either has no entry the day before or that day had no flow — the
 *  first day of each bleeding streak, not every bleeding day. */
export function derivePeriodStartDates(sortedDateFlowPairs) {
  const startDates = [];
  let previousDate = null;
  let previousHadFlow = false;

  for (const { date, flowIntensity } of sortedDateFlowPairs) {
    const hasFlow = flowIntensity && flowIntensity !== 'none';
    const isConsecutiveDay = previousDate && daysBetween(previousDate, date) === 1;
    if (hasFlow && !(isConsecutiveDay && previousHadFlow)) {
      startDates.push(date);
    }
    previousDate = date;
    previousHadFlow = hasFlow;
  }
  return startDates;
}

function daysBetween(isoDateA, isoDateB) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(isoDateB) - new Date(isoDateA)) / msPerDay);
}

/** The real average length of the person's own logged bleeding streaks —
 *  feeds the "menstrual phase" length used by cycle-prediction.js instead
 *  of a fabricated default, once there's real history to draw it from.
 *
 *  Only *closed* streaks are counted: a streak counts only once a later
 *  logged day (at any distance, not necessarily the very next one)
 *  proves it actually ended. The final streak in the whole list is never
 *  counted even if a bleeding day, because there's no way to know yet
 *  whether it's already over — the same "don't guess where real data can
 *  confirm it instead" rule derivePeriodStartDates already follows for
 *  where a streak *starts*.
 *
 *  null with no confirmed-ended streak in the history yet (including an
 *  empty list, or a single still-open streak). */
export function averagePeriodLengthDays(sortedDateFlowPairs) {
  const sorted = [...sortedDateFlowPairs].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;

  const streaks = [];
  let current = null;
  let previousDate = null;
  let previousHadFlow = false;

  for (const { date, flowIntensity } of sorted) {
    const hasFlow = flowIntensity && flowIntensity !== 'none';
    const isConsecutiveDay = previousDate && daysBetween(previousDate, date) === 1;
    if (hasFlow) {
      if (current && isConsecutiveDay && previousHadFlow) {
        current.endDate = date;
        current.lengthDays += 1;
      } else {
        current = { endDate: date, lengthDays: 1 };
        streaks.push(current);
      }
    } else {
      current = null;
    }
    previousDate = date;
    previousHadFlow = hasFlow;
  }

  const lastLoggedDate = sorted[sorted.length - 1].date;
  const closedStreaks = streaks.filter((s) => s.endDate !== lastLoggedDate);
  return closedStreaks.length === 0 ? null : average(closedStreaks.map((s) => s.lengthDays));
}

function average(numbers) {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}
