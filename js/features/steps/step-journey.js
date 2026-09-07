// The "Step Trail" gamified visual — a winding path of footprint
// milestones toward today's real goal, the walker's position on it driven
// entirely by today's real logged (or live-counted) step count. Nothing
// here invents a step; see steps-view.ts for how the returned fraction
// drives a real SVG path position via getPointAtLength, the same "real
// attribute drives the data" contract as the goal ring's stroke-dashoffset.
const MILESTONE_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
/** Milestone markers along today's real progress toward `goal` — `reached`
 *  is a plain real-fraction comparison, nothing estimated. */
export function buildStepTrailMilestones(steps, goal) {
    const fraction = goal > 0 ? steps / goal : 0;
    return MILESTONE_FRACTIONS.map((f) => ({ fraction: f, reached: fraction >= f }));
}
/** Clamped 0..1 fraction of today's real steps toward `goal` — where the
 *  walker marker sits along the trail path. Clamped at 1 even once the
 *  goal is beaten (the trail itself only ever draws a single lap; the
 *  ring elsewhere on this screen is what shows a beaten goal's overflow). */
export function stepTrailProgress(steps, goal) {
    if (!(goal > 0))
        return 0;
    return Math.max(0, Math.min(1, steps / goal));
}
//# sourceMappingURL=step-journey.js.map