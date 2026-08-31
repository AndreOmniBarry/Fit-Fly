function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function generateWhiteNoise(length, rng = Math.random) {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++)
        buffer[i] = rng() * 2 - 1;
    return buffer;
}
/** Paul Kellet's refined pink-noise filter — a -3dB/octave tilt applied to
 *  white noise, the "softer" texture behind rain/wind/ocean layers. */
export function generatePinkNoise(length, rng = Math.random) {
    const buffer = new Float32Array(length);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
        const white = rng() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        buffer[i] = clamp(pink * 0.11, -1, 1);
    }
    return buffer;
}
/** A random walk (leaky integrator), clamped — a -6dB/octave tilt, the
 *  deep, rumble-free texture behind fireplace/steady-noise layers. */
export function generateBrownNoise(length, rng = Math.random) {
    const buffer = new Float32Array(length);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
        const white = rng() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        buffer[i] = clamp(lastOut * 3.5, -1, 1);
    }
    return buffer;
}
/** Blends the buffer's tail into its head so looping it doesn't produce
 *  an audible click/seam at the repeat point — the tail isn't modified,
 *  only the head is reshaped to continue smoothly from where the tail
 *  left off. `fadeSamples` is clamped to at most half the buffer. */
export function crossfadeLoopBuffer(buffer, fadeSamples) {
    const length = buffer.length;
    const fade = Math.max(0, Math.min(fadeSamples, Math.floor(length / 2)));
    const out = Float32Array.from(buffer);
    for (let i = 0; i < fade; i++) {
        const fadeIn = i / fade;
        const tailSample = buffer[length - fade + i];
        out[i] = out[i] * fadeIn + tailSample * (1 - fadeIn);
    }
    return out;
}
//# sourceMappingURL=noise-synthesis.js.map