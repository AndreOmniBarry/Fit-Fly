import { describe, expect, it } from 'vitest';
import { calculateSleepDebt, describeSleepDebt, DEFAULT_SLEEP_GOAL_MINUTES } from '../../../js/features/sleep/sleep-debt.js';

function log(date, durationMinutes) {
  return { date, bedTime: null, wakeTime: null, durationMinutes, quality: null, notes: '', loggedAt: `${date}T08:00:00.000Z` };
}

describe('calculateSleepDebt', () => {
  it('zero nights logged means zero debt', () => {
    const debt = calculateSleepDebt([]);
    expect(debt).toEqual({ debtMinutes: 0, nightsConsidered: 0, goalMinutes: DEFAULT_SLEEP_GOAL_MINUTES, averageMinutes: null });
  });

  it('hitting the goal every night carries no debt', () => {
    const logs = [log('2024-01-01', 480), log('2024-01-02', 480), log('2024-01-03', 500)];
    const debt = calculateSleepDebt(logs);
    expect(debt.debtMinutes).toBe(0);
    expect(debt.nightsConsidered).toBe(3);
  });

  it('sums shortfalls across nights', () => {
    const logs = [log('2024-01-01', 420), log('2024-01-02', 450)]; // 60 + 30 short of 480
    const debt = calculateSleepDebt(logs);
    expect(debt.debtMinutes).toBe(90);
  });

  it('a great night does not cancel out debt from a rough one', () => {
    const logs = [log('2024-01-01', 300), log('2024-01-02', 600)]; // 180 short, then 120 over
    const debt = calculateSleepDebt(logs);
    expect(debt.debtMinutes).toBe(180); // not 60 — surplus never offsets
  });

  it('respects a custom goal', () => {
    const logs = [log('2024-01-01', 400)];
    const debt = calculateSleepDebt(logs, 420);
    expect(debt.debtMinutes).toBe(20);
    expect(debt.goalMinutes).toBe(420);
  });

  it('reports the average duration across the window', () => {
    const logs = [log('2024-01-01', 400), log('2024-01-02', 500)];
    const debt = calculateSleepDebt(logs);
    expect(debt.averageMinutes).toBe(450);
  });
});

describe('describeSleepDebt', () => {
  it('prompts logging when there is nothing to go on', () => {
    expect(describeSleepDebt(calculateSleepDebt([]))).toMatch(/log a few nights/i);
  });

  it('praises a clean record', () => {
    const debt = calculateSleepDebt([log('2024-01-01', 480), log('2024-01-02', 500)]);
    expect(describeSleepDebt(debt)).toMatch(/every night/i);
  });

  it('states the shortfall in hours', () => {
    const debt = calculateSleepDebt([log('2024-01-01', 360)]); // 2h short
    expect(describeSleepDebt(debt)).toMatch(/2h behind/i);
  });
});
