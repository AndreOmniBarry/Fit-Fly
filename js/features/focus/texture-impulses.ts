// Sparse transient textures — individual rain-droplet ticks, fireplace
// crackle-pops — layered on top of the continuous colored-noise beds in
// noise-synthesis.ts. A real rainfall or fire isn't just filtered hiss:
// it's a continuous bed *plus* discrete, irregularly-timed impulsive
// events, and it's exactly that second layer this module adds. Pure
// math, mixed into the same kind of loopable Float32Array buffer as
// every other layer (audio-engine.ts runs it through the same
// crossfadeLoopBuffer seamless-loop treatment) — no live scheduling
// needed, unlike the slower wave/gust modulation in wander.ts.
import type { Rng } from './prng.js';

export interface ImpulseTrainOptions {
  /** Average impulses per second. A real Poisson process (see
   *  generateImpulseTrain's own comment) — irregular onsets, the same
   *  honest "genuinely stochastic, not a metronome" stance as the
   *  thunder module's randomized inter-clap delay. */
  density: number;
  /** Each impulse's own duration range, seconds. */
  minDurationSeconds: number;
  maxDurationSeconds: number;
  /** Peak amplitude range per impulse, 0-1 — real droplets/pops vary in
   *  loudness, never one fixed level repeated. */
  minGain: number;
  maxGain: number;
  /** Exponential decay rate shaping each impulse's own envelope — higher
   *  reads as a snappier, shorter-feeling tick; lower as a rounder pop. */
  decayRate: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A real Poisson point process: onset gaps are drawn from an exponential
 *  distribution with the given average rate, not evenly spaced and not
 *  independently re-rolled-until-it-looks-random — this is the actual
 *  statistics behind "raindrops land at genuinely random moments". */
function* poissonOnsets(rng: Rng, ratePerSecond: number, totalSeconds: number): Generator<number> {
  let t = 0;
  while (t < totalSeconds) {
    // -ln(uniform)/rate is the standard inverse-CDF draw for an
    // exponential inter-arrival time; guard against rng() returning
    // exactly 0 (ln(0) is -Infinity) with a tiny floor.
    const gap = -Math.log(Math.max(rng(), 1e-9)) / ratePerSecond;
    t += gap;
    if (t < totalSeconds) yield t;
  }
}

/**
 * @param sampleRate
 * @param lengthSeconds Total buffer length — same 24s layer-buffer
 *   duration every other loopable texture in this app uses.
 */
export function generateImpulseTrain(
  sampleRate: number,
  lengthSeconds: number,
  options: ImpulseTrainOptions,
  rng: Rng = Math.random
): Float32Array {
  const length = Math.max(1, Math.floor(sampleRate * lengthSeconds));
  const buffer = new Float32Array(length);

  for (const onsetSeconds of poissonOnsets(rng, options.density, lengthSeconds)) {
    const durationSeconds = options.minDurationSeconds + rng() * (options.maxDurationSeconds - options.minDurationSeconds);
    const gain = options.minGain + rng() * (options.maxGain - options.minGain);
    const impulseLength = Math.max(1, Math.floor(durationSeconds * sampleRate));
    const onsetSample = Math.floor(onsetSeconds * sampleRate);

    for (let i = 0; i < impulseLength; i++) {
      const sampleIndex = onsetSample + i;
      if (sampleIndex >= length) break;
      const t = i / impulseLength;
      const envelope = Math.exp(-options.decayRate * t) * gain;
      // Additive, not overwritten — two impulses landing close together
      // (a real possibility in a genuine Poisson process) sum instead of
      // one silently clobbering the other.
      buffer[sampleIndex] = clamp((buffer[sampleIndex] as number) + (rng() * 2 - 1) * envelope, -1, 1);
    }
  }

  return buffer;
}
