// A day's step count converted to an estimated real-world distance —
// reuses the profile's own real height, same honesty contract as
// steps-calorie-estimate.js's weight-based estimate: null, never a
// fabricated number, when there's nothing real to estimate from (no
// profile height on file, or no steps yet).
//
// Stride length ≈ height × 0.414 is the constant widely cited in
// pedometer/gait-calibration literature (the classic formula behind most
// consumer pedometers' own distance readouts) as an average adult's
// stride length as a fraction of standing height — used only to convert a
// raw step count into an estimated distance, never presented as a
// lab-measured stride.
const STRIDE_LENGTH_FACTOR = 0.414;
export function estimateDistanceFromSteps({ steps, heightCm, }) {
    if (!(steps > 0) || !(heightCm != null && heightCm > 0))
        return null;
    const strideLengthMeters = (heightCm / 100) * STRIDE_LENGTH_FACTOR;
    return { meters: steps * strideLengthMeters, method: 'height-stride-formula' };
}
/** "~1.2 km" / "~850 m" — the "~" is deliberate: this is always an
 *  estimate from a formula, never a measured distance (Steps has no GPS
 *  of its own — that's Run's job). */
export function formatStepsDistance(meters) {
    if (meters >= 1000)
        return `~${(meters / 1000).toFixed(1)} km walked today`;
    return `~${Math.round(meters)} m walked today`;
}
//# sourceMappingURL=steps-distance-estimate.js.map