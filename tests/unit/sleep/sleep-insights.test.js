import { describe, expect, it } from 'vitest';
import { calculateSleepFactorInsights } from '../../../js/features/sleep/sleep-insights.js';

function log(date, bedTime, durationMinutes, quality) {
  return { date, bedTime, wakeTime: null, durationMinutes, quality, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('calculateSleepFactorInsights: not enough data', () => {
  it('returns nothing with no logs at all', () => {
    expect(calculateSleepFactorInsights([])).toEqual([]);
  });

  it('returns nothing when fewer than 6 nights have a bedTime', () => {
    const logs = [
      log('2024-01-01', '2024-01-01T23:00:00.000Z', 480, 5),
      log('2024-01-02', '2024-01-02T23:00:00.000Z', 480, 5),
    ];
    expect(calculateSleepFactorInsights(logs)).toEqual([]);
  });
});

describe('calculateSleepFactorInsights: consistent bedtime', () => {
  const consistentNights = [
    log('2024-01-01', '2024-01-01T23:00:00.000Z', 480, 5),
    log('2024-01-02', '2024-01-02T23:00:00.000Z', 480, 5),
    log('2024-01-03', '2024-01-03T23:00:00.000Z', 480, 5),
    log('2024-01-04', '2024-01-04T23:00:00.000Z', 480, 5),
  ];
  const scatteredNights = [
    log('2024-01-05', '2024-01-05T19:00:00.000Z', 360, 2),
    log('2024-01-06', '2024-01-06T20:00:00.000Z', 360, 2),
    log('2024-01-07', '2024-01-08T02:00:00.000Z', 360, 2),
    log('2024-01-08', '2024-01-09T03:30:00.000Z', 360, 2),
  ];
  const logs = [...consistentNights, ...scatteredNights];

  it('surfaces a positive, real point delta favoring the consistent group', () => {
    const insights = calculateSleepFactorInsights(logs);
    const consistency = insights.find((i) => i.label === 'Consistent bedtime');
    expect(consistency).toBeTruthy();
    expect(consistency.deltaPoints).toBeGreaterThan(0);
    expect(consistency.favorable).toBe(true);
    expect(consistency.nightsWithFactor).toBe(4);
    expect(consistency.nightsWithoutFactor).toBe(4);
  });
});

describe('calculateSleepFactorInsights: late bedtimes', () => {
  const lateNights = [
    log('2024-01-01', '2024-01-02T01:30:00.000Z', 300, 2),
    log('2024-01-02', '2024-01-03T02:00:00.000Z', 300, 2),
    log('2024-01-03', '2024-01-04T03:00:00.000Z', 300, 2),
  ];
  const earlyNights = [
    log('2024-01-04', '2024-01-04T21:30:00.000Z', 480, 5),
    log('2024-01-05', '2024-01-05T22:00:00.000Z', 480, 5),
    log('2024-01-06', '2024-01-06T23:00:00.000Z', 480, 5),
  ];

  it('flags late bedtimes as unfavorable when they score worse', () => {
    const insights = calculateSleepFactorInsights([...lateNights, ...earlyNights]);
    const late = insights.find((i) => i.label === 'Nights logged past 1am');
    expect(late).toBeTruthy();
    expect(late.deltaPoints).toBeLessThan(0);
    expect(late.favorable).toBe(false);
    expect(late.nightsWithFactor).toBe(3);
    expect(late.nightsWithoutFactor).toBe(3);
  });
});

describe('calculateSleepFactorInsights: logs without a bedTime are excluded, not crashed on', () => {
  it('ignores bedTime-less logs entirely', () => {
    const logs = [
      log('2024-01-01', null, 480, 5),
      log('2024-01-02', null, 300, 2),
    ];
    expect(calculateSleepFactorInsights(logs)).toEqual([]);
  });
});
