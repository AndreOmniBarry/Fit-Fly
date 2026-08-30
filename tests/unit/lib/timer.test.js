import { describe, expect, it } from 'vitest';
import { createCountdown, createStopwatch, formatDuration } from '../../../js/lib/timer.js';

/** A controllable fake clock so these tests never depend on real elapsed
 *  wall-clock time (no flakiness, no waiting). */
function fakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe('createCountdown', () => {
  it('reports the full duration before start() and does not tick on its own', () => {
    const clock = fakeClock();
    const timer = createCountdown(30_000, { now: clock.now });
    expect(timer.getRemainingMs()).toBe(30_000);
    clock.advance(5000);
    expect(timer.getRemainingMs()).toBe(30_000); // no start() yet — nothing elapses
  });

  it('computes remaining time from the wall clock, not from tick counting', () => {
    const clock = fakeClock();
    const timer = createCountdown(30_000, { now: clock.now });
    timer.start();
    clock.advance(12_000);
    expect(timer.getRemainingMs()).toBe(18_000);
  });

  it('survives a huge single time jump exactly as correctly as many small ones', () => {
    // Simulates a backgrounded/throttled tab: the UI's poll loop simply
    // didn't run for a while, then the clock jumps forward all at once.
    // A tick-counting timer would have silently lost that time; this one
    // reads it correctly because it was never tracking ticks at all.
    const clock = fakeClock();
    const timer = createCountdown(60_000, { now: clock.now });
    timer.start();
    clock.advance(47_000); // one big stalled gap, not 47 one-second ticks
    expect(timer.getRemainingMs()).toBe(13_000);
  });

  it('never goes negative once time runs out', () => {
    const clock = fakeClock();
    const timer = createCountdown(10_000, { now: clock.now });
    timer.start();
    clock.advance(999_999);
    expect(timer.getRemainingMs()).toBe(0);
    expect(timer.isFinished()).toBe(true);
  });

  it('pause() freezes the remaining time and resume continues from there', () => {
    const clock = fakeClock();
    const timer = createCountdown(30_000, { now: clock.now });
    timer.start();
    clock.advance(10_000);
    timer.pause();
    expect(timer.getRemainingMs()).toBe(20_000);

    clock.advance(100_000); // time passes while paused — must not count
    expect(timer.getRemainingMs()).toBe(20_000);

    timer.start(); // resume
    clock.advance(5_000);
    expect(timer.getRemainingMs()).toBe(15_000);
  });

  it('reset() restores the original duration (or a new one) and stops running', () => {
    const clock = fakeClock();
    const timer = createCountdown(30_000, { now: clock.now });
    timer.start();
    clock.advance(20_000);
    timer.reset();
    expect(timer.getRemainingMs()).toBe(30_000);
    expect(timer.running).toBe(false);

    timer.reset(45_000);
    expect(timer.getRemainingMs()).toBe(45_000);
  });

  it('running reflects state accurately', () => {
    const clock = fakeClock();
    const timer = createCountdown(10_000, { now: clock.now });
    expect(timer.running).toBe(false);
    timer.start();
    expect(timer.running).toBe(true);
    timer.pause();
    expect(timer.running).toBe(false);
  });

  it('a finished, unpaused timer cannot be restarted by calling start() again', () => {
    const clock = fakeClock();
    const timer = createCountdown(1000, { now: clock.now });
    timer.start();
    clock.advance(2000);
    expect(timer.isFinished()).toBe(true);
    timer.start(); // should no-op — remaining is already 0
    clock.advance(1);
    expect(timer.getRemainingMs()).toBe(0);
  });
});

describe('createStopwatch', () => {
  it('starts at zero and counts up from the wall clock', () => {
    const clock = fakeClock();
    const sw = createStopwatch({ now: clock.now });
    expect(sw.getElapsedMs()).toBe(0);
    sw.start();
    clock.advance(9000);
    expect(sw.getElapsedMs()).toBe(9000);
  });

  it('pause freezes elapsed time; a later start accumulates on top', () => {
    const clock = fakeClock();
    const sw = createStopwatch({ now: clock.now });
    sw.start();
    clock.advance(5000);
    sw.pause();
    clock.advance(50_000); // must not count while paused
    expect(sw.getElapsedMs()).toBe(5000);

    sw.start();
    clock.advance(3000);
    expect(sw.getElapsedMs()).toBe(8000);
  });

  it('reset returns to zero and stops running', () => {
    const clock = fakeClock();
    const sw = createStopwatch({ now: clock.now });
    sw.start();
    clock.advance(10_000);
    sw.reset();
    expect(sw.getElapsedMs()).toBe(0);
    expect(sw.running).toBe(false);
  });

  it('a big single jump is read correctly, same as the countdown', () => {
    const clock = fakeClock();
    const sw = createStopwatch({ now: clock.now });
    sw.start();
    clock.advance(123_456);
    expect(sw.getElapsedMs()).toBe(123_456);
  });
});

describe('formatDuration', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(599_000)).toBe('9:59');
  });

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(3_661_000)).toBe('1:01:01');
  });

  it('floors to the whole second, never shows a fraction', () => {
    expect(formatDuration(1999)).toBe('0:01');
  });

  it('clamps negative input to zero instead of formatting a negative time', () => {
    expect(formatDuration(-5000)).toBe('0:00');
  });
});
