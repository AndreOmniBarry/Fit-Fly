import { describe, expect, it } from 'vitest';
import {
  calculateNapDebtCredit,
  calculateSleepDebtWithNaps,
  describeNapDebtCredit,
  MAX_NAP_DEBT_CREDIT_MINUTES,
  NAP_DEBT_CREDIT_FRACTION,
} from '../../../js/features/sleep/nap-debt.js';
import { calculateSleepDebt, DEFAULT_SLEEP_GOAL_MINUTES } from '../../../js/features/sleep/sleep-debt.js';

function log(date, durationMinutes) {
  return { date, bedTime: null, wakeTime: null, durationMinutes, quality: null, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

function nap(date, durationMinutes) {
  return { date, durationMinutes };
}

describe('calculateNapDebtCredit', () => {
  it('credits nothing for no nap', () => {
    expect(calculateNapDebtCredit(0)).toBe(0);
    expect(calculateNapDebtCredit(-5)).toBe(0);
  });

  it('credits a fraction of nap minutes, not a 1:1 trade', () => {
    // 30 min nap -> 30% credit, well short of 1:1.
    expect(calculateNapDebtCredit(30)).toBe(Math.round(30 * NAP_DEBT_CREDIT_FRACTION));
    expect(calculateNapDebtCredit(30)).toBeLessThan(30);
  });

  it('caps credit even for a very long nap', () => {
    // 400 minutes * 30% = 120, well over the cap.
    expect(calculateNapDebtCredit(400)).toBe(MAX_NAP_DEBT_CREDIT_MINUTES);
  });
});

describe('calculateSleepDebtWithNaps', () => {
  it('with no naps at all, matches calculateSleepDebt exactly (purely additive)', () => {
    const logs = [log('2024-01-01', 360), log('2024-01-02', 420)];
    const plain = calculateSleepDebt(logs);
    const withNaps = calculateSleepDebtWithNaps(logs, []);

    expect(withNaps.debtMinutes).toBe(plain.debtMinutes);
    expect(withNaps.nightsConsidered).toBe(plain.nightsConsidered);
    expect(withNaps.goalMinutes).toBe(plain.goalMinutes);
    expect(withNaps.averageMinutes).toBe(plain.averageMinutes);
    expect(withNaps.napCreditMinutes).toBe(0);
    expect(withNaps.debtMinutesBeforeNapCredit).toBe(plain.debtMinutes);
  });

  it('zero nights logged means zero debt regardless of naps', () => {
    const result = calculateSleepDebtWithNaps([], [nap('2024-01-01', 30)]);
    expect(result.debtMinutes).toBe(0);
    expect(result.napCreditMinutes).toBe(0);
  });

  it('a nap the same date reduces that night\'s own shortfall, partially', () => {
    // 420 (7h) goal, 360 minutes slept -> 60 min shortfall.
    const logs = [log('2024-01-01', 360)];
    const naps = [nap('2024-01-01', 60)]; // 60 * 0.3 = 18 min credit
    const result = calculateSleepDebtWithNaps(logs, naps);

    expect(result.debtMinutesBeforeNapCredit).toBe(60);
    expect(result.napCreditMinutes).toBe(18);
    expect(result.debtMinutes).toBe(42);
    expect(result.debtMinutes).toBeGreaterThan(0); // never fully offset
  });

  it('a nap on a different date does not credit an unrelated night', () => {
    const logs = [log('2024-01-01', 360)]; // 60 min short
    const naps = [nap('2024-01-05', 60)]; // a different day entirely
    const result = calculateSleepDebtWithNaps(logs, naps);

    expect(result.napCreditMinutes).toBe(0);
    expect(result.debtMinutes).toBe(60);
  });

  it('nap credit never exceeds that night\'s own shortfall (no banked surplus)', () => {
    // Goal hit exactly -> 0 shortfall, so even a real nap that day credits 0.
    const logs = [log('2024-01-01', DEFAULT_SLEEP_GOAL_MINUTES)];
    const naps = [nap('2024-01-01', 90)];
    const result = calculateSleepDebtWithNaps(logs, naps);

    expect(result.debtMinutesBeforeNapCredit).toBe(0);
    expect(result.napCreditMinutes).toBe(0);
    expect(result.debtMinutes).toBe(0);
  });

  it('several naps the same date are summed before crediting', () => {
    const logs = [log('2024-01-01', 300)]; // 120 min short of a 420 goal
    const naps = [nap('2024-01-01', 20), nap('2024-01-01', 20)]; // 40 total -> 12 credit
    const result = calculateSleepDebtWithNaps(logs, naps);

    expect(result.napCreditMinutes).toBe(12);
    expect(result.debtMinutes).toBe(108);
  });

  it('sums nap-adjusted shortfall across multiple nights independently', () => {
    const logs = [log('2024-01-01', 360), log('2024-01-02', 360)]; // 60 short each
    const naps = [nap('2024-01-01', 100)]; // only night one gets credit
    const result = calculateSleepDebtWithNaps(logs, naps);

    // Night one: 60 - min(60, round(100*0.3)=30) = 30. Night two: 60 (no nap).
    expect(result.napCreditMinutes).toBe(30);
    expect(result.debtMinutes).toBe(90);
  });
});

describe('describeNapDebtCredit', () => {
  it('is null when nothing was credited', () => {
    expect(describeNapDebtCredit(0)).toBeNull();
  });

  it('describes a real credit in plain language', () => {
    expect(describeNapDebtCredit(18)).toMatch(/18m credited/i);
    expect(describeNapDebtCredit(90)).toMatch(/1\.5h credited/i);
  });
});
