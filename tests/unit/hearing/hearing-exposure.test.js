import { describe, expect, it } from 'vitest';
import {
  dailyDoseFromSessions,
  localDateFromIso,
  summarizeMonitorSession,
} from '../../../js/features/hearing/hearing-exposure.js';

describe('localDateFromIso', () => {
  it('extracts the local calendar date, not a UTC slice', () => {
    expect(localDateFromIso('2026-03-15T00:00:00')).toBe('2026-03-15');
  });
});

describe('summarizeMonitorSession', () => {
  it('is all zero/null for fewer than 2 samples — nothing real to measure a duration from', () => {
    const summary = summarizeMonitorSession([{ estimatedDb: 70, recordedAt: '2026-03-15T09:00:00Z' }]);
    expect(summary).toEqual({ dosePercent: 0, twaDb: null, totalHours: 0, spikeCount: 0 });
  });

  it('computes a real dose, TWA, duration, and spike count from raw samples', () => {
    const summary = summarizeMonitorSession([
      { estimatedDb: 85, recordedAt: '2026-03-15T09:00:00Z' },
      { estimatedDb: 85, recordedAt: '2026-03-15T09:30:00Z' }, // 0.5h at the 85 dB criterion
      { estimatedDb: 100, recordedAt: '2026-03-15T09:31:00Z' }, // a real 15 dB jump — a spike
    ]);
    expect(summary.totalHours).toBeGreaterThan(0.5);
    expect(summary.dosePercent).toBeGreaterThan(0);
    expect(summary.twaDb).not.toBeNull();
    expect(summary.spikeCount).toBe(1);
  });
});

describe('dailyDoseFromSessions', () => {
  it('is empty for no sessions', () => {
    expect(dailyDoseFromSessions([])).toEqual([]);
  });

  it('sums real dose across multiple sessions the same real day — additive, not averaged away', () => {
    const daily = dailyDoseFromSessions([
      { startedAt: '2026-03-15T08:00:00', dosePercent: 10 },
      { startedAt: '2026-03-15T20:00:00', dosePercent: 25 }, // same day, evening session
      { startedAt: '2026-03-16T08:00:00', dosePercent: 5 }, // a different day entirely
    ]);
    expect(daily).toEqual(
      expect.arrayContaining([
        { date: '2026-03-15', value: 35 },
        { date: '2026-03-16', value: 5 },
      ])
    );
    expect(daily).toHaveLength(2);
  });
});
