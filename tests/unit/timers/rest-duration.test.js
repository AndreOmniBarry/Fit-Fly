import { describe, expect, it } from 'vitest';
import { parseRepsMidpoint, selectRestSeconds } from '../../../js/features/timers/rest-duration.js';

describe('parseRepsMidpoint', () => {
  it('reads the midpoint of a "low-high" range', () => {
    expect(parseRepsMidpoint('8-12')).toBe(10);
    expect(parseRepsMidpoint('3-6')).toBe(4.5);
    expect(parseRepsMidpoint('15-20')).toBe(17.5);
  });

  it('accepts a lone number with no range at all', () => {
    expect(parseRepsMidpoint('10')).toBe(10);
  });

  it('falls back to a moderate default rather than throwing on garbage input', () => {
    expect(parseRepsMidpoint(undefined)).toBe(10);
    expect(parseRepsMidpoint('')).toBe(10);
    expect(parseRepsMidpoint('lots')).toBe(10);
    expect(parseRepsMidpoint('-5')).toBe(10);
  });
});

describe('selectRestSeconds', () => {
  it('gives a heavy, low-rep, loaded compound lift the full 2-3min range', () => {
    // e.g. a strength-focus dumbbell bench press or squat at 3-6 reps.
    const restSec = selectRestSeconds({ pattern: 'push', logMetric: 'reps-weight', reps: '3-6' });
    expect(restSec).toBe(180);
    expect(restSec).toBeGreaterThanOrEqual(120);
    expect(restSec).toBeLessThanOrEqual(180);
  });

  it('gives a moderate-rep loaded compound lift a real, shorter-than-max rest, still well over a minute', () => {
    // hypertrophy-range dumbbell bench press at 8-12 reps.
    const restSec = selectRestSeconds({ pattern: 'push', logMetric: 'reps-weight', reps: '8-12' });
    expect(restSec).toBe(120);
  });

  it('gives isolation/endurance-style high-rep work the short 60-90s range', () => {
    // a bodyweight core exercise at a high, endurance-style rep count.
    const restSec = selectRestSeconds({ pattern: 'core', logMetric: 'reps', reps: '15-20' });
    expect(restSec).toBe(60);
    expect(restSec).toBeGreaterThanOrEqual(60);
    expect(restSec).toBeLessThanOrEqual(90);
  });

  it('a bodyweight (unloaded) compound movement rests less than the same rep range loaded', () => {
    const bodyweight = selectRestSeconds({ pattern: 'push', logMetric: 'reps', reps: '8-12' });
    const loaded = selectRestSeconds({ pattern: 'push', logMetric: 'reps-weight', reps: '8-12' });
    expect(bodyweight).toBeLessThan(loaded);
  });

  it('a low-rep set rests longer than a moderate-rep set of the same exercise', () => {
    const lowRep = selectRestSeconds({ pattern: 'hinge', logMetric: 'reps-weight', reps: '3-6' });
    const moderateRep = selectRestSeconds({ pattern: 'hinge', logMetric: 'reps-weight', reps: '8-12' });
    const highRep = selectRestSeconds({ pattern: 'hinge', logMetric: 'reps-weight', reps: '15-20' });
    expect(lowRep).toBeGreaterThan(moderateRep);
    expect(moderateRep).toBeGreaterThan(highRep);
  });

  it('an isolation pattern (core) never reaches the heavy-compound tier, even at low reps', () => {
    const restSec = selectRestSeconds({ pattern: 'core', logMetric: 'reps', reps: '3-6' });
    expect(restSec).toBeLessThan(180);
  });

  it('a timed isometric hold gets a short, active-recovery-style break', () => {
    const restSec = selectRestSeconds({ pattern: 'core', logMetric: 'time' });
    expect(restSec).toBe(45);
  });

  it('a timed cardio bout gets the shortest break of anything — sustained conditioning, not max output', () => {
    const restSec = selectRestSeconds({ pattern: 'cardio', logMetric: 'time' });
    expect(restSec).toBe(30);
    expect(restSec).toBeLessThan(selectRestSeconds({ pattern: 'core', logMetric: 'time' }));
  });

  it('is a pure function: identical input always gives the identical answer', () => {
    const input = { pattern: 'squat', logMetric: 'reps-weight', reps: '8-12' };
    expect(selectRestSeconds(input)).toBe(selectRestSeconds({ ...input }));
  });

  it('never returns a non-positive or non-finite duration for any real pattern/logMetric combination', () => {
    const patterns = ['squat', 'hinge', 'push', 'pull', 'core', 'cardio'];
    const metrics = ['reps-weight', 'reps', 'time'];
    const repRanges = [undefined, '3-6', '8-12', '15-20'];
    for (const pattern of patterns) {
      for (const logMetric of metrics) {
        for (const reps of repRanges) {
          const restSec = selectRestSeconds({ pattern, logMetric, reps });
          expect(Number.isFinite(restSec)).toBe(true);
          expect(restSec).toBeGreaterThan(0);
        }
      }
    }
  });
});
