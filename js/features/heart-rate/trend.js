// Real insight from saved readings, not just a reverse-chronological
// list — the whole point of a reading getting auto-saved is that it can
// add up to something. Pure and deterministic: no I/O, no clock reads —
// caller supplies the samples (newest first, same order
// listRecentHeartRateSamples already returns) and how many recent ones
// count as "recent."

const DEFAULT_WINDOW_SIZE = 10;

/**
 * @param {{bpm:number}[]} samplesNewestFirst
 * @param {number} [windowSize]
 * @returns {{latest:number, average:number, min:number, max:number,
 *   deltaFromPrevious:number|null, sampleCount:number,
 *   sparklineOldestFirst:number[]}|null} null with no readings at all.
 */
export function summarizeHeartRateTrend(samplesNewestFirst, windowSize = DEFAULT_WINDOW_SIZE) {
  if (samplesNewestFirst.length === 0) return null;

  const window = samplesNewestFirst.slice(0, windowSize);
  const bpms = window.map((s) => s.bpm);
  const average = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);

  return {
    latest: window[0].bpm,
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
