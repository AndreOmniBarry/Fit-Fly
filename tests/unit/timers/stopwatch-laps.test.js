import { describe, expect, it } from 'vitest';
import { buildLapRecord, classifyLaps, formatStopwatchTime } from '../../../js/features/timers/stopwatch-laps.js';

describe('formatStopwatchTime', () => {
  it('formats sub-minute time with real centiseconds', () => {
    expect(formatStopwatchTime(0)).toBe('0:00.00');
    expect(formatStopwatchTime(500)).toBe('0:00.50');
    expect(formatStopwatchTime(9_990)).toBe('0:09.99');
  });

  it('formats minutes and seconds once past a minute', () => {
    expect(formatStopwatchTime(65_430)).toBe('1:05.43');
    expect(formatStopwatchTime(599_990)).toBe('9:59.99');
  });

  it('formats hours once past 60 minutes', () => {
    expect(formatStopwatchTime(3_661_000)).toBe('1:01:01.00');
    expect(formatStopwatchTime(7_384_250)).toBe('2:03:04.25');
  });

  it('never goes negative for a bad input', () => {
    expect(formatStopwatchTime(-500)).toBe('0:00.00');
  });

  it('floors to the real centisecond, never rounds up', () => {
    expect(formatStopwatchTime(1_009)).toBe('0:01.00');
    expect(formatStopwatchTime(1_019)).toBe('0:01.01');
  });
});

describe('buildLapRecord', () => {
  it('the first lap\'s lap time equals its split time (previous split is 0)', () => {
    const lap = buildLapRecord(1, 0, 12_340);
    expect(lap).toEqual({ lapNumber: 1, lapMs: 12_340, splitMs: 12_340 });
  });

  it('a later lap\'s lap time is the real delta since the previous split', () => {
    const lap = buildLapRecord(2, 12_340, 25_000);
    expect(lap).toEqual({ lapNumber: 2, lapMs: 12_660, splitMs: 25_000 });
  });

  it('never reports a negative lap time even with an inconsistent input', () => {
    const lap = buildLapRecord(3, 10_000, 9_000);
    expect(lap.lapMs).toBe(0);
  });
});

describe('classifyLaps', () => {
  it('names no fastest/slowest with fewer than 3 laps — not enough for a real comparison', () => {
    const oneLap = [buildLapRecord(1, 0, 10_000)];
    expect(classifyLaps(oneLap)).toEqual({ fastestLapNumber: null, slowestLapNumber: null });

    const twoLaps = [buildLapRecord(1, 0, 10_000), buildLapRecord(2, 10_000, 25_000)];
    expect(classifyLaps(twoLaps)).toEqual({ fastestLapNumber: null, slowestLapNumber: null });
  });

  it('finds the real fastest and slowest lap by lap time, not split time', () => {
    const laps = [
      buildLapRecord(1, 0, 10_000), // lap 1: 10.0s
      buildLapRecord(2, 10_000, 18_000), // lap 2: 8.0s (fastest)
      buildLapRecord(3, 18_000, 30_000), // lap 3: 12.0s (slowest, even though its split is biggest by construction anyway)
    ];
    expect(classifyLaps(laps)).toEqual({ fastestLapNumber: 2, slowestLapNumber: 3 });
  });

  it('a later, faster lap still wins over an earlier one despite a bigger split', () => {
    const laps = [
      buildLapRecord(1, 0, 20_000), // lap 1: 20.0s (slowest)
      buildLapRecord(2, 20_000, 30_000), // lap 2: 10.0s
      buildLapRecord(3, 30_000, 35_000), // lap 3: 5.0s (fastest, smallest lap time, biggest split)
    ];
    expect(classifyLaps(laps)).toEqual({ fastestLapNumber: 3, slowestLapNumber: 1 });
  });

  it('ties resolve to the earliest lap', () => {
    const laps = [
      buildLapRecord(1, 0, 10_000),
      buildLapRecord(2, 10_000, 20_000),
      buildLapRecord(3, 20_000, 30_000),
    ];
    // All three laps are exactly 10.0s — nothing real to highlight either way.
    expect(classifyLaps(laps)).toEqual({ fastestLapNumber: null, slowestLapNumber: null });
  });
});
