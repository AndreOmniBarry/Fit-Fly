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
