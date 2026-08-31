// A small, dependency-free number count-up — animates a numeric display
// from whatever it currently shows to a new value over a short real
// duration, eased out. The same kinetic-data language as the Hub's tile
// ring (a real number drawn in as motion, never decorative) applied to
// plain text — a score or stat that *arrives* rather than snapping in.
// Respects prefers-reduced-motion: jumps straight to the final value
// there, no motion for its own sake.
import { prefersReducedMotion } from './motion.js';

export interface CountUpOptions {
  durationMs?: number;
  /** Formats the (possibly fractional, mid-animation) number for display
   *  — e.g. Math.round for a plain integer, or a duration formatter for
   *  something like "7h 30m" animating through its underlying minutes. */
  formatter?: (n: number) => string;
}

const DEFAULT_FORMATTER = (n: number): string => String(Math.round(n));

// A monotonically increasing counter is a simpler, genuinely-unique token
// per call than anything hashed or randomized — collisions are
// impossible, not just unlikely.
let callCounter = 0;

/** Animates `el`'s text from the number already in it (parsed loosely —
 *  the first run of digits/decimal/minus) to `toValue`. Safe to call
 *  repeatedly (a fresh call cancels/overrides whatever the last one was
 *  still animating, since each just races toward its own target). */
export function animateCountUp(el: HTMLElement, toValue: number, options: CountUpOptions = {}): void {
  const { durationMs = 900, formatter = DEFAULT_FORMATTER } = options;
  const match = el.textContent?.match(/-?\d+(\.\d+)?/);
  const fromValue = match ? Number(match[0]) : 0;

  if (prefersReducedMotion() || fromValue === toValue) {
    el.textContent = formatter(toValue);
    return;
  }

  const start = performance.now();
  const token = String(++callCounter);
  el.dataset.countUpToken = token;

  function tick(now: number): void {
    // A newer animateCountUp() call on this same element supersedes this
    // one — its own rAF loop is now driving the text instead.
    if (el.dataset.countUpToken !== token) return;
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = formatter(fromValue + (toValue - fromValue) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
