import { describe, expect, it } from 'vitest';
import {
  summarizeNoiseTrend,
  loudReadingsInLastNDays,
  calculateNoiseCheckStreak,
} from '../../../js/features/hearing/hearing-trend.js';

describe('summarizeNoiseTrend', () => {
  it('is null with no check-ins at all', () => {
    expect(summarizeNoiseTrend([])).toBeNull();
  });

  it('a single check-in has a latest/average/max equal to itself', () => {
    const result = summarizeNoiseTrend([{ estimatedDb: 68, category: 'moderate' }]);
    expect(result).toEqual({
      latest: 68,
      latestCategory: 'moderate',
      average: 68,
      max: 68,
      sampleCount: 1,
      sparklineOldestFirst: [68],
    });
  });

  it('computes a real average/max across several check-ins, newest first', () => {
    const result = summarizeNoiseTrend([
      { estimatedDb: 90, category: 'harmful' },
      { estimatedDb: 70, category: 'loud' },
      { estimatedDb: 50, category: 'quiet' },
    ]);
    expect(result.latest).toBe(90);
    expect(result.latestCategory).toBe('harmful');
    expect(result.average).toBe(70);
    expect(result.max).toBe(90);
    expect(result.sampleCount).toBe(3);
    expect(result.sparklineOldestFirst).toEqual([50, 70, 90]); // chronological, oldest first
  });

  it('only ever looks at the most recent windowSize check-ins, ignoring older ones', () => {
    const checkIns = [
      { estimatedDb: 60 },
      { estimatedDb: 60 },
      { estimatedDb: 60 },
      { estimatedDb: 999 }, // deliberately outside the window
    ];
    const result = summarizeNoiseTrend(checkIns, 3);
    expect(result.sampleCount).toBe(3);
    expect(result.max).toBe(60);
  });
});

describe('loudReadingsInLastNDays', () => {
  const today = new Date('2026-03-15T12:00:00.000Z');

  it('is 0 with nothing logged', () => {
    expect(loudReadingsInLastNDays([], 7, today)).toBe(0);
  });

  it('counts only very-loud-or-worse readings, never quiet/moderate/loud ones', () => {
    const checkIns = [
      { category: 'quiet', recordedAt: '2026-03-14T12:00:00.000Z' },
      { category: 'moderate', recordedAt: '2026-03-14T12:00:00.000Z' },
      { category: 'loud', recordedAt: '2026-03-14T12:00:00.000Z' },
      { category: 'very-loud', recordedAt: '2026-03-14T12:00:00.000Z' },
      { category: 'harmful', recordedAt: '2026-03-14T12:00:00.000Z' },
      { category: 'dangerous', recordedAt: '2026-03-14T12:00:00.000Z' },
    ];
    expect(loudReadingsInLastNDays(checkIns, 7, today)).toBe(3);
  });

  it('excludes readings older than the window', () => {
    const checkIns = [
      { category: 'dangerous', recordedAt: '2026-01-01T12:00:00.000Z' }, // months earlier
      { category: 'dangerous', recordedAt: '2026-03-14T12:00:00.000Z' },
    ];
    expect(loudReadingsInLastNDays(checkIns, 7, today)).toBe(1);
  });
});

describe('calculateNoiseCheckStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateNoiseCheckStreak([])).toBe(0);
  });

  it('counts consecutive days ending at the most recent check-in', () => {
    const checkIns = [
      { recordedAt: '2026-03-15T08:00:00.000Z' },
      { recordedAt: '2026-03-14T08:00:00.000Z' },
      { recordedAt: '2026-03-13T08:00:00.000Z' },
    ];
    expect(calculateNoiseCheckStreak(checkIns)).toBe(3);
  });

  it('breaks on a gap', () => {
    const checkIns = [
      { recordedAt: '2026-03-15T08:00:00.000Z' },
      { recordedAt: '2026-03-10T08:00:00.000Z' },
    ];
    expect(calculateNoiseCheckStreak(checkIns)).toBe(1);
  });

  it('several check-ins on the same day only count as one streak day', () => {
    const checkIns = [
      { recordedAt: '2026-03-15T08:00:00.000Z' },
      { recordedAt: '2026-03-15T18:00:00.000Z' },
      { recordedAt: '2026-03-14T08:00:00.000Z' },
    ];
    expect(calculateNoiseCheckStreak(checkIns)).toBe(2);
  });
});
