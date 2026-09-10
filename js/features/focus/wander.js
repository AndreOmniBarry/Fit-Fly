function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/**
 * @param startValue The curve's own first value — a caller continuing an
 *   already-running wander (see audio-engine.ts's rescheduling) passes
 *   its previous chunk's final value here so the join between chunks is
 *   continuous, not a jump.
 */
export function generateWanderCurve(durationSeconds, options, startValue, rng = Math.random) {
    const { minValue, maxValue, minSegmentSeconds, maxSegmentSeconds } = options;
    const breakpoints = [{ timeSeconds: 0, value: clamp(startValue, minValue, maxValue) }];
    let t = 0;
    while (t < durationSeconds) {
        const segmentSeconds = minSegmentSeconds + rng() * (maxSegmentSeconds - minSegmentSeconds);
        t += segmentSeconds;
        const value = minValue + rng() * (maxValue - minValue);
        breakpoints.push({ timeSeconds: t, value });
    }
    return breakpoints;
}
/** Linear-interpolates a wander curve at an arbitrary time — used by unit
 *  tests to assert real properties of the curve (it stays in range, it's
 *  continuous, ...) without needing a live AudioParam; audio-engine.ts
 *  itself never calls this; it schedules the breakpoints directly onto a
 *  real AudioParam via linearRampToValueAtTime, which does the same
 *  linear interpolation in the audio thread. */
export function sampleWanderCurve(breakpoints, timeSeconds) {
    if (breakpoints.length === 0)
        return 0;
    const first = breakpoints[0];
    if (timeSeconds <= first.timeSeconds)
        return first.value;
    for (let i = 1; i < breakpoints.length; i++) {
        const prev = breakpoints[i - 1];
        const cur = breakpoints[i];
        if (timeSeconds <= cur.timeSeconds) {
            const span = cur.timeSeconds - prev.timeSeconds;
            const frac = span > 0 ? (timeSeconds - prev.timeSeconds) / span : 0;
            return prev.value + (cur.value - prev.value) * frac;
        }
    }
    return breakpoints[breakpoints.length - 1].value;
}
//# sourceMappingURL=wander.js.map