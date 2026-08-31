/**
 * @param durationSeconds Length of the tail.
 * @param sampleRate Samples/sec — 48000 for the "high rez" AudioContext
 *   this feature runs at.
 * @param decay Higher = faster decay (a shorter, tighter-sounding room).
 */
export function generateImpulseResponse(durationSeconds, sampleRate, decay = 2.5, rng = Math.random) {
    const length = Math.max(1, Math.floor(durationSeconds * sampleRate));
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = Math.pow(1 - t, decay);
        buffer[i] = (rng() * 2 - 1) * envelope;
    }
    return buffer;
}
//# sourceMappingURL=impulse-response.js.map