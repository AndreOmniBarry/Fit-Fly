import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { evaluateAllBadges } from '../../../js/features/badges/badge-engine.js';
import { listEarnedBadges } from '../../../js/db/repositories/badges.js';
import { saveSleepLog } from '../../../js/db/repositories/sleep-logs.js';
import { setStepsForDate } from '../../../js/db/repositories/steps.js';
import { addHydrationEntry } from '../../../js/db/repositories/hydration.js';
import { saveCompletedRun } from '../../../js/db/repositories/runs.js';
import { createSession } from '../../../js/db/repositories/sessions.js';

describe('evaluateAllBadges', () => {
  let db;

  beforeEach(() => {
    db = createDb(`badge-engine-test-${Math.random()}`);
  });

  it('with nothing logged anywhere, every tier is unearned and nothing is persisted', async () => {
    const badges = await evaluateAllBadges(db);
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((b) => !b.earned && b.earnedAt === null)).toBe(true);
    expect(await listEarnedBadges(db)).toEqual([]);
  });

  it('a real 3-night sleep streak earns Sleep Starter and persists it with a real earned date', async () => {
    await saveSleepLog({ date: '2026-03-13', bedTime: null, wakeTime: null, durationMinutes: 420, quality: 3, notes: '' }, db);
    await saveSleepLog({ date: '2026-03-14', bedTime: null, wakeTime: null, durationMinutes: 430, quality: 3, notes: '' }, db);
    await saveSleepLog({ date: '2026-03-15', bedTime: null, wakeTime: null, durationMinutes: 410, quality: 3, notes: '' }, db);

    const badges = await evaluateAllBadges(db);
    const starter = badges.find((b) => b.id === 'sleep-streak-3');
    expect(starter.earned).toBe(true);
    expect(starter.earnedAt).not.toBeNull();
    // The next tier up genuinely isn't reached yet.
    expect(badges.find((b) => b.id === 'sleep-streak-7').earned).toBe(false);

    const stored = await listEarnedBadges(db);
    expect(stored.map((b) => b.id)).toContain('sleep-streak-3');
  });

  it('a real single-day 10,000-step day earns the 10K Day badge without needing a lifetime total', async () => {
    await setStepsForDate(12500, '2026-03-15', db);
    const badges = await evaluateAllBadges(db);
    expect(badges.find((b) => b.id === 'steps-single-day-10k').earned).toBe(true);
    // Nowhere near the lifetime total tiers from one day.
    expect(badges.find((b) => b.id === 'steps-lifetime-100k').earned).toBe(false);
  });

  it('hydration lifetime total is a real sum, correctly converted from milliliters to liters', async () => {
    // 60 entries of 1000ml = 60L — clears the 50L tier, not the 200L one.
    for (let i = 0; i < 60; i++) {
      await addHydrationEntry({ amountMl: 1000, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }, db);
    }
    const badges = await evaluateAllBadges(db);
    expect(badges.find((b) => b.id === 'hydration-lifetime-50l').earned).toBe(true);
    expect(badges.find((b) => b.id === 'hydration-lifetime-200l').earned).toBe(false);
  });

  it('run badges read a real cumulative distance and a real run count', async () => {
    await saveCompletedRun({ startedAt: '2026-03-01T09:00:00.000Z', distanceMeters: 3000 }, db);
    await saveCompletedRun({ startedAt: '2026-03-03T09:00:00.000Z', distanceMeters: 2500 }, db);

    const badges = await evaluateAllBadges(db);
    expect(badges.find((b) => b.id === 'run-count-1').earned).toBe(true);
    expect(badges.find((b) => b.id === 'run-count-10').earned).toBe(false);
    // 3000m + 2500m = 5.5km, clears the 5K total tier.
    expect(badges.find((b) => b.id === 'run-distance-5k').earned).toBe(true);
    expect(badges.find((b) => b.id === 'run-distance-half').earned).toBe(false);
  });

  it('workouts-count reads a real session count, strength and logged activity alike', async () => {
    await createSession({ type: 'strength' }, db);
    await createSession({ type: 'activity' }, db);
    const badges = await evaluateAllBadges(db);
    expect(badges.find((b) => b.id === 'workouts-count-1').earned).toBe(true);
    expect(badges.find((b) => b.id === 'workouts-count-10').earned).toBe(false);
  });

  it('once earned, a badge stays earned with its original date even if evaluated again later', async () => {
    await setStepsForDate(12000, '2026-03-15', db);
    const first = await evaluateAllBadges(db);
    const firstEarnedAt = first.find((b) => b.id === 'steps-single-day-10k').earnedAt;

    const second = await evaluateAllBadges(db);
    const secondEarnedAt = second.find((b) => b.id === 'steps-single-day-10k').earnedAt;

    expect(secondEarnedAt).toBe(firstEarnedAt);
    expect(await listEarnedBadges(db)).toHaveLength(1);
  });
});
