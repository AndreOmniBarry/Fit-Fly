// A transparent, rule-based Sleep score — duration vs. goal, bedtime
// consistency, and self-rated quality, blended and explained in plain
// language. Same honesty stance as readiness.js: no wearable-derived
// metric this app doesn't actually have, no invented precision, and the
// component breakdown always ships alongside the number so "why this" is
// never a black box.
import { calculateSleepConsistency } from './sleep-consistency.js';
import { DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
const WEIGHTS = {
    duration: 0.45,
    quality: 0.3,
    consistency: 0.25,
};
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function durationScore(durationMinutes, goalMinutes) {
    return clamp((durationMinutes / goalMinutes) * 100, 0, 100);
}
/** 1 (terrible) - 5 (excellent) self-rating. */
function qualityScore(quality) {
    return clamp((quality / 5) * 100, 0, 100);
}
function categoryFor(score) {
    if (score < 50)
        return 'poor';
    if (score < 70)
        return 'fair';
    if (score < 85)
        return 'good';
    return 'great';
}
/**
 * @param tonight The night being scored.
 * @param recentLogs A trailing window of logs (tonight included, if it's
 *   already saved) used only to compute bedtime consistency — pass
 *   whatever's already been fetched, no I/O happens here.
 * @param goalMinutes The person's sleep goal, in minutes.
 */
export function calculateSleepScore(tonight, recentLogs = [], goalMinutes = DEFAULT_SLEEP_GOAL_MINUTES) {
    const consistency = calculateSleepConsistency(recentLogs);
    const components = {
        duration: durationScore(tonight.durationMinutes, goalMinutes),
        quality: tonight.quality == null ? null : qualityScore(tonight.quality),
        consistency: consistency.score,
    };
    const known = Object.entries(components).filter((entry) => entry[1] != null);
    const totalWeight = known.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
    const weightedSum = known.reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);
    const score = Math.round(weightedSum / totalWeight);
    const category = categoryFor(score);
    return { score, category, components, reasoning: buildReasoning(components, category, goalMinutes, tonight.durationMinutes) };
}
function buildReasoning(components, category, goalMinutes, durationMinutes) {
    const reasoning = [];
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
        reasoning.push(category === 'great' || category === 'good'
            ? 'Duration, consistency, and how it felt all look solid.'
            : 'Nothing stands out strongly either way — a fairly average night.');
    }
    return reasoning;
}
//# sourceMappingURL=sleep-score.js.map