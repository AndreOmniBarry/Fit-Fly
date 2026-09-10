function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/** A real Poisson point process: onset gaps are drawn from an exponential
 *  distribution with the given average rate, not evenly spaced and not
 *  independently re-rolled-until-it-looks-random — this is the actual
 *  statistics behind "raindrops land at genuinely random moments". */
function* poissonOnsets(rng, ratePerSecond, totalSeconds) {
    let t = 0;
    while (t < totalSeconds) {
        // -ln(uniform)/rate is the standard inverse-CDF draw for an
        // exponential inter-arrival time; guard against rng() returning
        // exactly 0 (ln(0) is -Infinity) with a tiny floor.
        const gap = -Math.log(Math.max(rng(), 1e-9)) / ratePerSecond;
        t += gap;
        if (t < totalSeconds)
            yield t;
    }
}
/**
 * @param sampleRate
 * @param lengthSeconds Total buffer length — same 24s layer-buffer
 *   duration every other loopable texture in this app uses.
 */
export function generateImpulseTrain(sampleRate, lengthSeconds, options, rng = Math.random) {
    const length = Math.max(1, Math.floor(sampleRate * lengthSeconds));
    const buffer = new Float32Array(length);
    for (const onsetSeconds of poissonOnsets(rng, options.density, lengthSeconds)) {
        const durationSeconds = options.minDurationSeconds + rng() * (options.maxDurationSeconds - options.minDurationSeconds);
        const gain = options.minGain + rng() * (options.maxGain - options.minGain);
        const impulseLength = Math.max(1, Math.floor(durationSeconds * sampleRate));
        const onsetSample = Math.floor(onsetSeconds * sampleRate);
        for (let i = 0; i < impulseLength; i++) {
            const sampleIndex = onsetSample + i;
            if (sampleIndex >= length)
                break;
            const t = i / impulseLength;
            const envelope = Math.exp(-options.decayRate * t) * gain;
            // Additive, not overwritten — two impulses landing close together
            // (a real possibility in a genuine Poisson process) sum instead of
            // one silently clobbering the other.
            buffer[sampleIndex] = clamp(buffer[sampleIndex] + (rng() * 2 - 1) * envelope, -1, 1);
        }
    }
    return buffer;
}
//# sourceMappingURL=texture-impulses.js.map