// A procedurally-generated reverb impulse response — no IR file can be
// fetched in an offline-first PWA with no server, so this synthesizes one:
// exponentially-decaying noise, the standard way to build a plausible
// "small room" IR from scratch. Pure math; the audio-engine module turns
// this into a real ConvolverNode buffer.
import type { Rng } from './prng.js';

/**
 * @param durationSeconds Length of the tail.
 * @param sampleRate Samples/sec — 48000 for the "high rez" AudioContext
 *   this feature runs at.
 * @param decay Higher = faster decay (a shorter, tighter-sounding room).
 */
export function generateImpulseResponse(
  durationSeconds: number,
  sampleRate: number,
  decay = 2.5,
  rng: Rng = Math.random
): Float32Array {
  const length = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const buffer = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const envelope = Math.pow(1 - t, decay);
    buffer[i] = (rng() * 2 - 1) * envelope;
  }
  return buffer;
}
