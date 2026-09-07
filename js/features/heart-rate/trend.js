// Real insight from saved readings, not just a reverse-chronological
// list — the whole point of a reading getting auto-saved is that it can
// add up to something. Pure and deterministic: no I/O, no clock reads —
// caller supplies the samples (newest first, same order
// listRecentHeartRateSamples already returns) and how many recent ones
// count as "recent."

const DEFAULT_WINDOW_SIZE = 10;

/**
 * @param {{bpm:number, source?:string, confidence?:string|null}[]} samplesNewestFirst
 * @param {number} [windowSize]
 * @returns {{latest:number, latestSource:string|undefined,
 *   latestConfidence:string|null|undefined, average:number, min:number,
 *   max:number, deltaFromPrevious:number|null, sampleCount:number,
 *   sparklineOldestFirst:number[]}|null} null with no readings at all.
 */
export function summarizeHeartRateTrend(samplesNewestFirst, windowSize = DEFAULT_WINDOW_SIZE) {
  if (samplesNewestFirst.length === 0) return null;

  const window = samplesNewestFirst.slice(0, windowSize);
  const bpms = window.map((s) => s.bpm);
  const average = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);

  return {
    latest: window[0].bpm,
    // The single biggest number on the whole screen still needs to say
    // whether it's a measured reading or a camera estimate — the same
    // "never let the most prominent figure be silently ambiguous" rule
    // every other measured-vs-estimated badge in this app already
    // follows, just applied to this card's own hero number too.
    latestSource: window[0].source,
    latestConfidence: window[0].confidence,
    average,
    min: Math.min(...bpms),
    max: Math.max(...bpms),
    // null with only one reading — there's nothing to compare it to yet,
    // never a fake "+0" that implies a second data point exists.
    deltaFromPrevious: window.length >= 2 ? window[0].bpm - window[1].bpm : null,
    sampleCount: window.length,
    sparklineOldestFirst: [...bpms].reverse(),
  };
}

/** Averages same-day readings into one real daily bpm — several readings
 *  in a day (manual + camera + BLE all in the same sitting) shouldn't
 *  multiply-count in a day's trend point, the same "group before
 *  bucketing" principle as Hydration's own groupHydrationByDate (sum
 *  there since ml genuinely adds up; average here since bpm doesn't).
 *  The basis for a real D/W/M/6M/Y trend (see js/lib/time-range.js)
 *  instead of a fixed "last N readings" sparkline.
 * @param {{bpm:number, recordedAt:string}[]} samples
 * @returns {Map<string, number>} 'YYYY-MM-DD' -> that day's average bpm
 */
export function groupHeartRateByDate(samples) {
  const totals = new Map();
  for (const sample of samples) {
    const date = sample.recordedAt.slice(0, 10);
    const bucket = totals.get(date) ?? { sum: 0, count: 0 };
    bucket.sum += sample.bpm;
    bucket.count += 1;
    totals.set(date, bucket);
  }
  const averages = new Map();
  for (const [date, { sum, count }] of totals) averages.set(date, sum / count);
  return averages;
}
