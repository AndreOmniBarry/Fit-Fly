// Real insight from logged check-ins, not just a reverse-chronological
// list — same principle as every other mini-app this session shipped.
import { calculateStreak } from '../../lib/streak.js';

const DEFAULT_WINDOW_SIZE = 10;

/**
 * @param {{estimatedDb:number, category:string, recordedAt:string}[]} checkInsNewestFirst
 * @param {number} [windowSize]
 * @returns {{latest:number, latestCategory:string, average:number, max:number,
 *   sampleCount:number, sparklineOldestFirst:number[]}|null}
 */
export function summarizeNoiseTrend(checkInsNewestFirst, windowSize = DEFAULT_WINDOW_SIZE) {
  if (checkInsNewestFirst.length === 0) return null;

  const window = checkInsNewestFirst.slice(0, windowSize);
  const levels = window.map((c) => c.estimatedDb);
  const average = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);

  return {
    latest: window[0].estimatedDb,
    latestCategory: window[0].category,
    average,
    max: Math.max(...levels),
    sampleCount: window.length,
    sparklineOldestFirst: [...levels].reverse(),
  };
}

/** Real count of check-ins reading "very-loud" or worse within the last
 *  `days` days — the number that actually matters for hearing-health
 *  awareness. An average can hide a genuinely loud moment behind a
 *  handful of quiet ones; this counts every one that crossed a real
 *  exposure-risk threshold instead. */
export function loudReadingsInLastNDays(checkIns, days, today = new Date()) {
  const cutoffMs = today.getTime() - days * 86_400_000;
  const RISK_CATEGORIES = new Set(['very-loud', 'harmful', 'dangerous']);
  return checkIns.filter(
    (c) => RISK_CATEGORIES.has(c.category) && new Date(c.recordedAt).getTime() >= cutoffMs
  ).length;
}

/** Consecutive days ending at the most recent check-in — same shared
 *  streak algorithm every other mini-app's logging streak uses. */
export function calculateNoiseCheckStreak(checkIns) {
  return calculateStreak(checkIns.map((c) => c.recordedAt.slice(0, 10)));
}
