const CYCLE_TARGET_MINUTES = 90;
const MIN_CYCLE_MINUTES = 45; // a very short night still gets one real (if compressed) cycle, not a fabricated 90
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function lerp(from, to, t) {
    return from + (to - from) * clamp(t, 0, 1);
}
/** How much of a cycle boundary is spent in a brief arousal — a real,
 *  well-documented feature of normal sleep architecture (everyone briefly
 *  surfaces between cycles, most people never remember it). Widened a
 *  little for a lower self-rated quality — the one place this model lets
 *  a real, subjective input shape the shape of the night, rather than
 *  inventing a cause it can't actually know. */
function boundaryAwakeFraction(quality) {
    if (quality == null)
        return 0.03;
    return clamp(0.065 - (quality - 1) * 0.013, 0.012, 0.065);
}
/**
 * @param durationMinutes Real, logged bedtime-to-waketime span.
 * @param quality Self-rated 1-5 quality for the same night, if logged —
 *   purely a shaping input (see boundaryAwakeFraction), never required.
 */
export function buildHypnogramModel(durationMinutes, quality = null) {
    const emptyStageMinutes = { awake: 0, rem: 0, light: 0, deep: 0 };
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return { segments: [], totalMinutes: 0, stageMinutes: emptyStageMinutes, stagePercent: { ...emptyStageMinutes } };
    }
    // Sleep-onset latency: a real, near-universal opening stretch of light
    // wakefulness before sleep proper starts — modeled as a small, capped
    // share of the night rather than a fixed minute count, so it scales
    // sanely for both a long night and a short nap-length one.
    const latencyMinutes = Math.round(clamp(durationMinutes * 0.045, 3, 18));
    const sleepMinutes = durationMinutes - latencyMinutes;
    const numCycles = Math.max(1, Math.round(sleepMinutes / CYCLE_TARGET_MINUTES));
    const rawCycleMinutes = sleepMinutes / numCycles;
    // A single very short "night" (a nap logged as a full sleep entry,
    // say) still gets exactly one cycle rather than being force-split into
    // sub-45-minute fragments that don't reflect anything real.
    const effectiveCycles = rawCycleMinutes < MIN_CYCLE_MINUTES && numCycles > 1 ? Math.max(1, Math.floor(sleepMinutes / MIN_CYCLE_MINUTES)) || 1 : numCycles;
    const cycleMinutes = sleepMinutes / effectiveCycles;
    // Build the whole night as an ordered list of (stage, minutes) slices,
    // then convert to cumulative offsets and round once at the end — this
    // is what guarantees the segments always sum to exactly durationMinutes
    // with no drift, rather than rounding each slice independently.
    const slices = [{ stage: 'awake', minutes: latencyMinutes }];
    for (let cycleIndex = 0; cycleIndex < effectiveCycles; cycleIndex++) {
        const progress = effectiveCycles === 1 ? 0.5 : cycleIndex / (effectiveCycles - 1);
        const isLastCycle = cycleIndex === effectiveCycles - 1;
        // Real, published pattern: deep sleep dominates early cycles and
        // thins out; REM is minimal early and lengthens toward morning.
        const deepFraction = lerp(0.32, 0.05, progress);
        const remFraction = lerp(0.09, 0.3, progress);
        const awakeFraction = isLastCycle ? 0 : boundaryAwakeFraction(quality);
        const lightFraction = clamp(1 - deepFraction - remFraction - awakeFraction, 0.15, 1);
        const cycleTotal = cycleMinutes;
        slices.push({ stage: 'light', minutes: cycleTotal * lightFraction * 0.55 });
        slices.push({ stage: 'deep', minutes: cycleTotal * deepFraction });
        slices.push({ stage: 'light', minutes: cycleTotal * lightFraction * 0.45 });
        slices.push({ stage: 'rem', minutes: cycleTotal * remFraction });
        if (awakeFraction > 0)
            slices.push({ stage: 'awake', minutes: cycleTotal * awakeFraction });
    }
    // Cumulative float offsets, rounded once — the last one is forced to
    // durationMinutes exactly so rounding drift across many small slices
    // never leaves the model short of (or over) the real logged span.
    let cursor = 0;
    const rawBoundaries = slices.map((slice) => (cursor += slice.minutes));
    const roundedBoundaries = rawBoundaries.map((b, i) => i === rawBoundaries.length - 1 ? durationMinutes : Math.round(b));
    const segments = [];
    let start = 0;
    for (let i = 0; i < slices.length; i++) {
        const end = Math.max(start, roundedBoundaries[i]);
        if (end > start)
            segments.push({ stage: slices[i].stage, startMinutes: start, endMinutes: end });
        start = end;
    }
    const stageMinutes = { awake: 0, rem: 0, light: 0, deep: 0 };
    for (const segment of segments)
        stageMinutes[segment.stage] += segment.endMinutes - segment.startMinutes;
    const stagePercent = {
        awake: Math.round((stageMinutes.awake / durationMinutes) * 100),
        rem: Math.round((stageMinutes.rem / durationMinutes) * 100),
        light: Math.round((stageMinutes.light / durationMinutes) * 100),
        deep: Math.round((stageMinutes.deep / durationMinutes) * 100),
    };
    return { segments, totalMinutes: durationMinutes, stageMinutes, stagePercent };
}
export const STAGE_LABEL = {
    awake: 'Awake',
    rem: 'REM',
    light: 'Light',
    deep: 'Deep',
};
/** Same category coloring language the rest of Sleep already uses, so a
 *  quick one-line summary can lean on it without importing sleep-score.ts
 *  into a chart module that otherwise has no reason to know about scoring. */
export function hypnogramSummaryLine(model, category) {
    if (model.totalMinutes === 0)
        return '';
    const parts = [
        `${model.stagePercent.deep}% deep`,
        `${model.stagePercent.rem}% REM`,
        `${model.stagePercent.light}% light`,
    ];
    const base = parts.join(' · ');
    return category ? `${base} — modeled from a ${category} night's typical architecture` : `${base} — modeled`;
}
//# sourceMappingURL=sleep-hypnogram.js.map