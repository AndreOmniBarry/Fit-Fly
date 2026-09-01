// A transparent, rule-based Sleep score — duration scored against the
// National Sleep Foundation's own age-banded recommendations (not an
// arbitrary flat goal — see sleep-duration-guideline.ts), bedtime
// consistency, and self-rated quality (the Consensus Sleep Diary's
// 5-point quality wording — see index.html's #sleep-log-quality chips),
// blended and explained in plain language. Same honesty stance as
// readiness.js: no wearable-derived metric this app doesn't actually
// have, no invented precision, and the component breakdown always ships
// alongside the number so "why this" is never a black box.
import { calculateSleepConsistency } from './sleep-consistency.js';
import { durationBandForAge, scoreDurationAgainstBand } from './sleep-duration-guideline.js';
const WEIGHTS = {
    duration: 0.45,
    quality: 0.3,
    consistency: 0.25,
};
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/** 1 (very poor) - 5 (very good) self-rating — see #sleep-log-quality's
 *  Consensus Sleep Diary-worded chips. */
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
 * @param age Whole years, if known (Sleep works without a profile — see
 *   the README's "Onboarding is optional") — picks which NSF age band
 *   duration is scored against; `null` falls back to the general-adult
 *   band, the same one every band's recommended minimum agrees on.
 */
export function calculateSleepScore(tonight, recentLogs = [], age = null) {
    const consistency = calculateSleepConsistency(recentLogs);
    const band = durationBandForAge(age);
    const components = {
        duration: scoreDurationAgainstBand(tonight.durationMinutes, band),
        quality: tonight.quality == null ? null : qualityScore(tonight.quality),
        consistency: consistency.score,
    };
    const known = Object.entries(components).filter((entry) => entry[1] != null);
    const totalWeight = known.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
    const weightedSum = known.reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0);
    const score = Math.round(weightedSum / totalWeight);
    const category = categoryFor(score);
    return { score, category, components, reasoning: buildReasoning(components, category, band, tonight.durationMinutes) };
}
function buildReasoning(components, category, band, durationMinutes) {
    const reasoning = [];
    const gotHours = Math.round((durationMinutes / 60) * 10) / 10;
    const rangeLabel = `${band.recommendedMinHours}-${band.recommendedMaxHours}h`;
    if (components.duration != null && components.duration < 70) {
        if (gotHours < band.recommendedMinHours) {
            reasoning.push(`${gotHours}h is short of the ${rangeLabel} range your age group typically needs — that's usually the biggest lever here.`);
        }
        else {
            reasoning.push(`${gotHours}h runs longer than the ${rangeLabel} range your age group typically needs — habitually long sleep has its own research-backed downsides, same as running short.`);
        }
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