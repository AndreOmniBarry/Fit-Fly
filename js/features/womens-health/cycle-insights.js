// Real, DOM-free insights derived from actual logged history — never a
// fabricated chart or made-up pattern. Every function here follows the
// same "not enough data yet? say so honestly" convention as everywhere
// else in this app (see how Hydration's own trend chart, js/lib/trend-
// chart.js, handles fewer than 2 points): each returns `null` or an empty
// array rather than a guess, and the view renders an honest building-
// state for that case instead of hiding the section outright.

import { cycleLengthHistory } from './cycle-prediction.js';

function average(numbers) {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function standardDeviation(numbers) {
  const mean = average(numbers);
  return Math.sqrt(average(numbers.map((n) => (n - mean) ** 2)));
}

/** How much the person's own logged cycle lengths actually vary — real
 *  min/max/average/standard-deviation off `cycleLengthHistory`, plus a
 *  `regularity` bucket using the same coefficient-of-variation thresholds
 *  as cycle-prediction.js's own predictionConfidence (kept in sync
 *  deliberately: "regular" here should mean the same thing "high
 *  confidence" does there — one underlying idea, not two).
 *
 *  null with fewer than 2 completed cycles (1 gap) — not enough history
 *  to say anything about variability yet, same threshold
 *  predictionConfidence uses before it will call anything more than
 *  "low" confidence.
 */
export function cycleLengthVariability(periodStartDates) {
  const history = cycleLengthHistory(periodStartDates);
  if (history.length < 2) return null;

  const lengths = history.map((h) => h.lengthDays);
  const averageDays = average(lengths);
  const stdDevDays = standardDeviation(lengths);
  const cv = stdDevDays / averageDays;
  const regularity = history.length >= 4 && cv < 0.1 ? 'regular' : cv < 0.2 ? 'somewhat variable' : 'irregular';

  return {
    averageDays,
    stdDevDays,
    minDays: Math.min(...lengths),
    maxDays: Math.max(...lengths),
    regularity,
  };
}

/** Real symptom-frequency counts across every logged day — how often each
 *  symptom that's actually been logged at least once shows up, as both a
 *  raw count and a percentage of logged days. Only symptoms that were
 *  actually picked at least once are returned (never pads the list out to
 *  every known symptom with a fake zero); sorted by frequency, most
 *  common first, ties broken alphabetically by label for a stable order.
 *
 * @param {{symptoms?: string[]}[]} logs - every decrypted log entry
 * @param {{id: string, label: string}[]} symptomDefs - id->label lookup
 *   (SYMPTOMS from constants.js in real use; injected here so this stays
 *   decoupled from that module, same reasoning cycle-prediction.js's own
 *   header comment gives for staying decoupled from the encrypted store).
 * @returns {{id: string, label: string, count: number, percent: number}[]}
 *   empty with no logged days at all.
 */
export function symptomFrequency(logs, symptomDefs) {
  if (logs.length === 0) return [];

  const labelById = new Map(symptomDefs.map((s) => [s.id, s.label]));
  const counts = new Map();
  for (const log of logs) {
    for (const id of log.symptoms ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: labelById.get(id) ?? id,
      count,
      percent: Math.round((count / logs.length) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
