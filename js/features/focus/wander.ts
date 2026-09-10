// A slow, organic modulation curve — the "breathing" behind ocean waves
// rolling in and receding, or wind gusting and easing — expressed as a
// list of (time, value) breakpoints. Real waves and gusts don't arrive on
// a fixed period (a plain LFO reads as mechanical almost immediately);
// this randomizes both the gap and the target value of every breakpoint,
// so linearly ramping AudioParam automation between them (audio-engine.ts's
// job, not this module's — pure math only, same split as every other
// DSP module here) produces a smooth but genuinely irregular wander
// instead of a metronomic pulse.
import type { Rng } from './prng.js';

export interface WanderOptions {
  minValue: number;
  maxValue: number;
  /** How long one ramp segment (one breakpoint to the next) lasts. */
  minSegmentSeconds: number;
  maxSegmentSeconds: number;
}

export interface WanderBreakpoint {
  /** Seconds from the start of this curve — always non-decreasing, and
   *  the last breakpoint is always >= durationSeconds so a caller never
   *  runs out of curve before the duration it asked for. */
  timeSeconds: number;
  /** Within [minValue, maxValue]. */
  value: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param startValue The curve's own first value — a caller continuing an
 *   already-running wander (see audio-engine.ts's rescheduling) passes
 *   its previous chunk's final value here so the join between chunks is
 *   continuous, not a jump.
 */
export function generateWanderCurve(
  durationSeconds: number,
  options: WanderOptions,
  startValue: number,
  rng: Rng = Math.random
): WanderBreakpoint[] {
  const { minValue, maxValue, minSegmentSeconds, maxSegmentSeconds } = options;
  const breakpoints: WanderBreakpoint[] = [{ timeSeconds: 0, value: clamp(startValue, minValue, maxValue) }];

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
export function sampleWanderCurve(breakpoints: WanderBreakpoint[], timeSeconds: number): number {
  if (breakpoints.length === 0) return 0;
  const first = breakpoints[0] as WanderBreakpoint;
  if (timeSeconds <= first.timeSeconds) return first.value;

  for (let i = 1; i < breakpoints.length; i++) {
    const prev = breakpoints[i - 1] as WanderBreakpoint;
    const cur = breakpoints[i] as WanderBreakpoint;
    if (timeSeconds <= cur.timeSeconds) {
      const span = cur.timeSeconds - prev.timeSeconds;
      const frac = span > 0 ? (timeSeconds - prev.timeSeconds) / span : 0;
      return prev.value + (cur.value - prev.value) * frac;
    }
  }
  return (breakpoints[breakpoints.length - 1] as WanderBreakpoint).value;
}
