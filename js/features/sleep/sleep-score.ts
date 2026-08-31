// A transparent, rule-based Sleep score — duration vs. goal, bedtime
// consistency, and self-rated quality, blended and explained in plain
// language. Same honesty stance as readiness.js: no wearable-derived
// metric this app doesn't actually have, no invented precision, and the
// component breakdown always ships alongside the number so "why this" is
// never a black box.
import { calculateSleepConsistency } from './sleep-consistency.js';
import { DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
import type { SleepCategory, SleepLog, SleepScoreComponents, SleepScoreResult } from './types.js';

const WEIGHTS: Record<keyof SleepScoreComponents, number> = {
  duration: 0.45,
  quality: 0.3,
  consistency: 0.25,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function durationScore(durationMinutes: number, goalMinutes: number): number {
  return clamp((durationMinutes / goalMinutes) * 100, 0, 100);
}

/** 1 (terrible) - 5 (excellent) self-rating. */
function qualityScore(quality: number): number {
  return clamp((quality / 5) * 100, 0, 100);
}

function categoryFor(score: number): SleepCategory {
  if (score < 50) return 'poor';
  if (score < 70) return 'fair';
  if (score < 85) return 'good';
  return 'great';
}

/**
 * @param tonight The night being scored.
 * @param recentLogs A trailing window of logs (tonight included, if it's
 *   already saved) used only to compute bedtime consistency — pass
 *   whatever's already been fetched, no I/O happens here.
 * @param goalMinutes The person's sleep goal, in minutes.
 */
export function calculateSleepScore(
  tonight: Pick<SleepLog, 'durationMinutes' | 'quality'>,
  recentLogs: SleepLog[] = [],
  goalMinutes: number = DEFAULT_SLEEP_GOAL_MINUTES
): SleepScoreResult {
  const consistency = calculateSleepConsistency(recentLogs);

  const components: SleepScoreComponents = {
    duration: durationScore(tonight.durationMinutes, goalMinutes),
    quality: tonight.quality == null ? null : qualityScore(tonight.quality),
    consistency: consistency.score,
  };

  const known = (Object.entries(components) as [keyof SleepScoreComponents, number | null][]).filter(
    (entry): entry is [keyof SleepScoreComponents, number] => entry[1] != null
  );
  const totalWeight = known.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
  const weightedSum = known.reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);
  const score = Math.round(weightedSum / totalWeight);
  const category = categoryFor(score);

  return { score, category, components, reasoning: buildReasoning(components, category, goalMinutes, tonight.durationMinutes) };
}

function buildReasoning(
  components: SleepScoreComponents,
  category: SleepCategory,
  goalMinutes: number,
  durationMinutes: number
): string[] {
  const reasoning: string[] = [];
  const goalHours = Math.round((goalMinutes / 60) * 10) / 10;
  const gotHours = Math.round((durationMinutes / 60) * 10) / 10;

  if (components.duration != null && components.duration < 70) {
    reasoning.push(`${gotHours}h is short of your ${goalHours}h goal — that's usually the biggest lever here.`);
  }
  if (components.consistency != null && components.consistency < 60) {
    reasoning.push('Your bedtime has been swinging around a lot lately.');
  }
  if (components.quality != null && components.quality < 60) {
    reasoning.push('You rated how it felt on the low side.');
  }

  if (reasoning.length === 0) {
    reasoning.push(
      category === 'great' || category === 'good'
        ? 'Duration, consistency, and how it felt all look solid.'
        : 'Nothing stands out strongly either way — a fairly average night.'
    );
  }

  return reasoning;
}
