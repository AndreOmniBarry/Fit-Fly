import { describe, expect, it } from 'vitest';
import {
  calculateNoiseDosePercent,
  detectNoiseSpikes,
  doseToTwa,
  permissibleExposureHours,
  samplesToDoseSegments,
} from '../../../js/features/hearing/noise-dose.js';

describe('permissibleExposureHours', () => {
  it('is 8 hours at the 85 dB criterion level', () => {
    expect(permissibleExposureHours(85)).toBeCloseTo(8, 5);
  });

  it('halves every 3 dB up, matching NIOSH\'s published table', () => {
    expect(permissibleExposureHours(88)).toBeCloseTo(4, 5);
    expect(permissibleExposureHours(91)).toBeCloseTo(2, 5);
    expect(permissibleExposureHours(94)).toBeCloseTo(1, 5);
  });

  it('doubles every 3 dB down', () => {
    expect(permissibleExposureHours(82)).toBeCloseTo(16, 5);
  });
});

describe('calculateNoiseDosePercent', () => {
  it('is exactly 0 for no segments — never fabricated', () => {
    expect(calculateNoiseDosePercent([])).toBe(0);
  });

  it('is 100% for a full 8 hours at exactly the 85 dB criterion', () => {
    expect(calculateNoiseDosePercent([{ estimatedDb: 85, durationHours: 8 }])).toBe(100);
  });

  it('is 200% for a full 8 hours at 88 dB (double the 85 dB dose rate)', () => {
    expect(calculateNoiseDosePercent([{ estimatedDb: 88, durationHours: 8 }])).toBe(200);
  });

  it('sums real dose across mixed-level segments, not just the loudest one', () => {
    // 4 hours at 88 dB (permissible time 4h -> 100% on its own) plus
    // 4 hours at 85 dB (permissible time 8h -> 50% on its own) = 150%.
    const dose = calculateNoiseDosePercent([
      { estimatedDb: 88, durationHours: 4 },
      { estimatedDb: 85, durationHours: 4 },
    ]);
    expect(dose).toBe(150);
  });

  it('is a small real fraction for a short, quiet session — never rounded up to something alarming', () => {
    // 70 dB for 2 hours: permissible time at 70 dB is 256h, so dose =
    // 2/256 = 0.78% — small, but a genuinely distinguishable-from-zero
    // real number at this function's own 1-decimal precision.
    const dose = calculateNoiseDosePercent([{ estimatedDb: 70, durationHours: 2 }]);
    expect(dose).toBeGreaterThan(0);
    expect(dose).toBeLessThan(1);
  });
});

describe('doseToTwa', () => {
  it('is null for zero dose or zero duration — no real steady-state level for "nothing happened"', () => {
    expect(doseToTwa(0, 8)).toBeNull();
    expect(doseToTwa(50, 0)).toBeNull();
  });

  it('is exactly 85 dB for a 100% dose over the full 8-hour criterion period', () => {
    expect(doseToTwa(100, 8)).toBe(85);
  });

  it('is exactly 88 dB for a 200% dose over 8 hours', () => {
    expect(doseToTwa(200, 8)).toBe(88);
  });

  it('round-trips with calculateNoiseDosePercent for a real steady-state session', () => {
    const dose = calculateNoiseDosePercent([{ estimatedDb: 91, durationHours: 8 }]);
    expect(doseToTwa(dose, 8)).toBe(91);
  });

  it('accounts for a session shorter than 8 hours — same dose rate over less time is a real lower TWA', () => {
    // 100% dose accumulated over just 4 hours implies a louder real
    // level than 100% accumulated over the full 8-hour day.
    const twaOver4h = doseToTwa(100, 4);
    const twaOver8h = doseToTwa(100, 8);
    expect(twaOver4h).toBeGreaterThan(twaOver8h);
  });
});

describe('detectNoiseSpikes', () => {
  it('is empty for fewer than 2 samples or a gradual trend', () => {
    expect(detectNoiseSpikes([])).toEqual([]);
    expect(detectNoiseSpikes([{ estimatedDb: 60, recordedAt: '2026-03-15T09:00:00Z' }])).toEqual([]);
    expect(
      detectNoiseSpikes([
        { estimatedDb: 60, recordedAt: '2026-03-15T09:00:00Z' },
        { estimatedDb: 65, recordedAt: '2026-03-15T09:01:00Z' },
      ])
    ).toEqual([]);
  });

  it('flags a real sudden jump of 15 dB or more', () => {
    const samples = [
      { estimatedDb: 55, recordedAt: '2026-03-15T09:00:00Z' },
      { estimatedDb: 56, recordedAt: '2026-03-15T09:01:00Z' },
      { estimatedDb: 78, recordedAt: '2026-03-15T09:02:00Z' }, // a real 22 dB jump — a slammed door, say
      { estimatedDb: 76, recordedAt: '2026-03-15T09:03:00Z' },
    ];
    const spikes = detectNoiseSpikes(samples);
    expect(spikes).toHaveLength(1);
    expect(spikes[0]).toMatchObject({ estimatedDb: 78, jumpDb: 22 });
  });

  it('never flags a drop, only a rise', () => {
    const samples = [
      { estimatedDb: 90, recordedAt: '2026-03-15T09:00:00Z' },
      { estimatedDb: 60, recordedAt: '2026-03-15T09:01:00Z' }, // a real drop, not a spike
    ];
    expect(detectNoiseSpikes(samples)).toEqual([]);
  });
});

describe('samplesToDoseSegments', () => {
  it('is empty for fewer than 2 samples — the first sample alone has no measurable duration', () => {
    expect(samplesToDoseSegments([])).toEqual([]);
    expect(samplesToDoseSegments([{ estimatedDb: 70, recordedAt: '2026-03-15T09:00:00Z' }])).toEqual([]);
  });

  it('turns consecutive samples into real elapsed-time segments', () => {
    const segments = samplesToDoseSegments([
      { estimatedDb: 70, recordedAt: '2026-03-15T09:00:00Z' },
      { estimatedDb: 90, recordedAt: '2026-03-15T09:30:00Z' }, // 30 real minutes later
    ]);
    expect(segments).toEqual([{ estimatedDb: 90, durationHours: 0.5 }]);
  });

  it('skips a segment with clock skew (non-positive duration) rather than fabricating one', () => {
    const segments = samplesToDoseSegments([
      { estimatedDb: 70, recordedAt: '2026-03-15T09:30:00Z' },
      { estimatedDb: 90, recordedAt: '2026-03-15T09:00:00Z' }, // out of order
    ]);
    expect(segments).toEqual([]);
  });

  it('feeds directly into a real dose calculation', () => {
    const segments = samplesToDoseSegments([
      { estimatedDb: 85, recordedAt: '2026-03-15T09:00:00Z' },
      { estimatedDb: 85, recordedAt: '2026-03-15T17:00:00Z' }, // a full 8 hours at the criterion level
    ]);
    expect(calculateNoiseDosePercent(segments)).toBe(100);
  });
});
