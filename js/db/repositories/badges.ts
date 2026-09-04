import { getDb } from '../client.js';
import { nowIso } from '../../lib/id.js';
import type { EarnedBadge } from '../../features/badges/types.js';

export async function listEarnedBadges(db = getDb()): Promise<EarnedBadge[]> {
  return db.earnedBadges.toArray();
}

/** Records a badge as earned the first time the app notices, and never
 *  again — a real medal, once earned, stays earned even if the streak
 *  that unlocked it later breaks. A badge already on file keeps its
 *  original `earnedAt` rather than being overwritten with today's date. */
export async function recordBadgeEarned(id: string, db = getDb()): Promise<void> {
  const existing = await db.earnedBadges.get(id);
  if (existing) return;
  await db.earnedBadges.add({ id, earnedAt: nowIso() });
}
