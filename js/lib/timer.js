// Wall-clock-based timers — never a naive setInterval tick counter.
//
// A `setInterval(fn, 1000)` that just does `remaining -= 1000` on every
// tick silently drifts: background tabs get throttled to (or entirely
// paused below) 1 tick/sec by the browser, a slow main thread delays
// ticks, and a phone screen lock can suspend timers outright. All of
// that makes an accumulated-tick countdown read wrong the moment the
// person looks back at it.
//
// These timers instead record a wall-clock timestamp (`now()`, real time,
// not a tick count) when started, and always *compute* remaining/elapsed
// time as `now() - startedAt` whenever asked — so however late or
// throttled the next check-in is, the value it reports is still exactly
// correct. A UI layer polls getRemainingMs()/getElapsedMs() on whatever
// cadence it likes (rAF, a loose setInterval) purely to know when to
// re-render — that cadence never becomes the source of truth for elapsed
// time.

/** A countdown from `durationMs` to 0. `now` is injectable for tests. */
export function createCountdown(durationMs, { now = () => Date.now() } = {}) {
  let startedAt = null;
  let remainingAtPause = durationMs;
  let running = false;

  function getRemainingMs() {
    if (!running) return remainingAtPause;
    return Math.max(0, remainingAtPause - (now() - startedAt));
  }

  function start() {
    if (running || remainingAtPause <= 0) return;
    startedAt = now();
    running = true;
  }

  function pause() {
    if (!running) return;
    remainingAtPause = getRemainingMs();
    running = false;
    startedAt = null;
  }

  function reset(newDurationMs = durationMs) {
    running = false;
    startedAt = null;
    remainingAtPause = newDurationMs;
  }

  return {
    start,
    pause,
    reset,
    getRemainingMs,
    isFinished: () => getRemainingMs() <= 0,
    get running() {
      return running;
    },
  };
}

/** A count-up stopwatch — session/exercise elapsed time. */
export function createStopwatch({ now = () => Date.now() } = {}) {
  let startedAt = null;
  let elapsedAtPause = 0;
  let running = false;

  function getElapsedMs() {
    if (!running) return elapsedAtPause;
    return elapsedAtPause + (now() - startedAt);
  }

  function start() {
    if (running) return;
    startedAt = now();
    running = true;
  }

  function pause() {
    if (!running) return;
    elapsedAtPause = getElapsedMs();
    running = false;
    startedAt = null;
  }

  function reset() {
    running = false;
    startedAt = null;
    elapsedAtPause = 0;
  }

  return {
    start,
    pause,
    reset,
    getElapsedMs,
    get running() {
      return running;
    },
  };
}

/** mm:ss (or h:mm:ss past an hour), floored to the whole second — never a
 *  fractional-second display. */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
