// Real thunderclap transients — not a sample file (nothing to fetch), a
// genuinely synthesized crack-and-rumble burst: a fast noise-burst attack
// (the crack) followed by a longer, lower-frequency decaying tail (the
// rumble), the same two-part shape a real clap of thunder has. Pure math;
// audio-engine.ts turns this into a real one-shot AudioBufferSourceNode
// and decides *when* to trigger one (see scheduleNextThunderclap there).
import type { Rng } from './prng.js';

export interface ThunderclapTiming {
  /** Total buffer length, seconds. */
  durationSeconds: number;
}

/** 0.6–1.4s, randomized per clap so consecutive claps don't sound
 *  identical — real thunder never repeats exactly either. */
export function randomThunderclapDuration(rng: Rng = Math.random): number {
  return 0.6 + rng() * 0.8;
}

/**
 * @param sampleRate
 * @param durationSeconds From randomThunderclapDuration (or a fixed value
 *   in tests, for a reproducible length).
 */
export function generateThunderclapBurst(sampleRate: number, durationSeconds: number, rng: Rng = Math.random): Float32Array {
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
