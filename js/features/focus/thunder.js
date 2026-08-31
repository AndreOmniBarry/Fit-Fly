/** 0.6–1.4s, randomized per clap so consecutive claps don't sound
 *  identical — real thunder never repeats exactly either. */
export function randomThunderclapDuration(rng = Math.random) {
    return 0.6 + rng() * 0.8;
}
/**
 * @param sampleRate
 * @param durationSeconds From randomThunderclapDuration (or a fixed value
 *   in tests, for a reproducible length).
 */
export function generateThunderclapBurst(sampleRate, durationSeconds, rng = Math.random) {
    const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
    const buffer = new Float32Array(length);
    // The crack: a sharp attack over the first ~1.5% of the buffer, so it
    // reads as a transient hit, not a fade-in.
    const attackEnd = Math.max(1, Math.floor(length * 0.015));
    for (let i = 0; i < length; i++) {
        const t = i / length;
        const attack = i < attackEnd ? i / attackEnd : 1;
        // A steep initial decay (the crack dying out) layered under a much
        // gentler overall decay (the low rumble trailing off) — two decay
        // rates is what keeps this from sounding like a single flat "boom".
        const crackDecay = Math.exp(-t * 14);
        const rumbleDecay = Math.pow(1 - t, 1.6);
        const envelope = attack * Math.max(crackDecay, rumbleDecay * 0.55);
        buffer[i] = (rng() * 2 - 1) * envelope;
    }
    return buffer;
}
//# sourceMappingURL=thunder.js.map