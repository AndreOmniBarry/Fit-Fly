import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../../js/db/client.js';
import { listEarnedBadges, recordBadgeEarned } from '../../../js/db/repositories/badges.js';

describe('badges repository', () => {
  let db;

  beforeEach(() => {
    db = createDb(`badges-repo-test-${Math.random()}`);
  });

  it('is empty before anything is earned', async () => {
    expect(await listEarnedBadges(db)).toEqual([]);
  });

  it('records a badge with a real earned timestamp', async () => {
    await recordBadgeEarned('sleep-streak-3', db);
    const badges = await listEarnedBadges(db);
    expect(badges).toHaveLength(1);
    expect(badges[0].id).toBe('sleep-streak-3');
    expect(typeof badges[0].earnedAt).toBe('string');
    expect(Number.isNaN(Date.parse(badges[0].earnedAt))).toBe(false);
  });

  it('recording the same badge twice keeps its original earned date — a real medal is never overwritten', async () => {
    await recordBadgeEarned('sleep-streak-3', db);
    const first = (await listEarnedBadges(db))[0].earnedAt;

    await recordBadgeEarned('sleep-streak-3', db);
    const second = (await listEarnedBadges(db))[0].earnedAt;

    expect(second).toBe(first);
    expect(await listEarnedBadges(db)).toHaveLength(1);
  });
});
