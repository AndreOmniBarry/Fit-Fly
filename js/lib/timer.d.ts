// Sidecar types for timer.js (hand-written JS, untouched — see
// tsconfig.json).
export interface Countdown {
  start(): void;
  pause(): void;
  reset(newDurationMs?: number): void;
  getRemainingMs(): number;
  isFinished(): boolean;
  readonly running: boolean;
}

export function createCountdown(durationMs: number, options?: { now?: () => number }): Countdown;

export interface Stopwatch {
  start(): void;
  pause(): void;
  reset(): void;
  getElapsedMs(): number;
  readonly running: boolean;
}

export function createStopwatch(options?: { now?: () => number }): Stopwatch;
export function formatDuration(ms: number): string;
