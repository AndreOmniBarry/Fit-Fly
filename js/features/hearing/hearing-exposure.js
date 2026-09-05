// Turns a completed Monitor session's real raw samples into its own
// dose/TWA summary, and a list of completed sessions into a real
// per-day exposure total — the same aggregation shape Steps/Hydration's
// own trend charts already feed into js/lib/time-range.js's D/W/M/6M/Y
// bucketing, applied here to noise dose instead of a daily activity
// total.
import { calculateNoiseDosePercent, detectNoiseSpikes, doseToTwa, samplesToDoseSegments } from './noise-dose.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Local calendar date from an ISO timestamp — the same local-day rule
 *  js/features/activity/active-energy.js's isSameLocalDay and
 *  js/features/programs/program-calendar.js's localDateFromIso already
 *  independently established (a session started late at night shouldn't
 *  count against the wrong day just because ISO's own slice is UTC). */
export function localDateFromIso(isoTimestamp) {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** A completed session's real dose, TWA, and spike count — computed
 *  straight from its own raw samples, nothing cached or assumed.
 *  `totalHours` is left at full precision (never rounded here) — a real
 *  Monitor session can honestly last well under a minute, and rounding
 *  to even 2 decimal places of an hour (≈36s) would silently floor a
 *  real short session's duration to a fabricated 0. Callers that want a
 *  human-readable duration should format it (e.g. js/lib/timer.js's
 *  formatDuration), which already floors to the nearest whole second on
 *  its own — rounding it twice here would only lose real precision for
 *  no benefit. */
export function summarizeMonitorSession(samplesOldestFirst) {
  const segments = samplesToDoseSegments(samplesOldestFirst);
  const dosePercent = calculateNoiseDosePercent(segments);
  const totalHours = segments.reduce((sum, seg) => sum + seg.durationHours, 0);
  return {
    dosePercent,
    twaDb: doseToTwa(dosePercent, totalHours),
    totalHours,
    spikeCount: detectNoiseSpikes(samplesOldestFirst).length,
  };
}

/** Real per-day dose, summed across every session that started on that
 *  real local day — NIOSH dose contributions are additive within a day
 *  (a morning commute plus an evening concert genuinely combine into
 *  one day's real total exposure), never averaged away or treated as
 *  independent unrelated numbers.
 *  @param {{startedAt:string, dosePercent:number}[]} sessions
 *  @returns {{date:string, value:number}[]} unsorted; feed straight into
 *    js/lib/time-range.js's bucketDailyPoints, which sorts its own output. */
export function dailyDoseFromSessions(sessions) {
  const byDate = new Map();
  for (const session of sessions) {
    const date = localDateFromIso(session.startedAt);
    byDate.set(date, (byDate.get(date) ?? 0) + session.dosePercent);
  }
  return [...byDate.entries()].map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }));
}
