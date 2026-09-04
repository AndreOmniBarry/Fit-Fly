// Pulls the one real number each badge group needs from the repository
// that already owns it, evaluates the catalog, and persists any
// newly-crossed tier — the only place in this feature that touches the
// database, so badge-definitions.ts's evaluator stays pure and testable.
//
// Explicit limits (rather than each repository's own smaller default) on
// every "recent" query below: a streak only ever needs to look back as
// far as the longest tier it's being checked against, so 60-400 is a
// generous margin over this catalog's longest streak tier (30) with real
// room for slow days between logs — never the true unbounded history,
// which is what listAll* is for on the lifetime-total groups.
import { getDb } from '../../db/client.js';
import { listRecentSleepLogs } from '../../db/repositories/sleep-logs.js';
import { listRecentMeditationSessions } from '../../db/repositories/meditation.js';
import { listRecentBloodPressureSamples } from '../../db/repositories/blood-pressure.js';
import { listRecentSpo2Samples } from '../../db/repositories/spo2.js';
import { listAllStepEntries } from '../../db/repositories/steps.js';
import { listAllHydrationEntries, sumHydrationEntries } from '../../db/repositories/hydration.js';
import { listAllRuns } from '../../db/repositories/runs.js';
import { listAllSessions } from '../../db/repositories/sessions.js';
import { listEarnedBadges, recordBadgeEarned } from '../../db/repositories/badges.js';
import { calculateLoggingStreak } from '../sleep/sleep-trends.js';
import { calculateMeditationStreak, totalMinutes } from '../meditate/meditate-trends.js';
import { calculateVitalsStreak } from '../vitals/vitals-streak.js';
import { calculateStepsStreak, bestStepsDayEver } from '../steps/steps-trend.js';
import { calculateHydrationStreak } from '../hydration/hydration-trend.js';
import { BADGE_GROUPS, evaluateBadgeGroup } from './badge-definitions.js';
import type { BadgeStatus } from './types.js';
import type { AppDb } from '../../db/client.js';

export interface EvaluatedBadge extends BadgeStatus {
  earnedAt: string | null;
}

/** Real current values for every badge group, computed from whatever's
 *  actually stored right now — one round trip per feature, not per tier.
 *  `db` is threadable (default the app singleton) purely so this — and
 *  evaluateAllBadges below — can run against an isolated test database,
 *  the same `db = getDb()` contract every repository already follows. */
async function computeCurrentValues(db: AppDb): Promise<Record<string, number>> {
  const [
    sleepLogs,
    meditationSessions,
    bpSamples,
    spo2Samples,
    stepEntries,
    hydrationEntries,
    runs,
    sessions,
  ] = await Promise.all([
    listRecentSleepLogs(60, db),
    listRecentMeditationSessions(400, db),
    listRecentBloodPressureSamples(200, db),
    listRecentSpo2Samples(200, db),
    listAllStepEntries(db),
    listAllHydrationEntries(db),
    listAllRuns(db),
    listAllSessions(db),
  ]);

  const vitalsDates = [...bpSamples, ...spo2Samples].map((s: { recordedAt: string }) => s.recordedAt.slice(0, 10));
  const bestStepsDay = bestStepsDayEver(stepEntries);
  const lifetimeSteps = stepEntries.reduce((sum: number, e: { steps: number }) => sum + e.steps, 0);
  const lifetimeHydrationL = sumHydrationEntries(hydrationEntries) / 1000;
  const lifetimeRunKm = runs.reduce((sum: number, r: { distanceMeters: number }) => sum + r.distanceMeters, 0) / 1000;

  return {
    'sleep-streak': calculateLoggingStreak(sleepLogs),
    'meditate-streak': calculateMeditationStreak(meditationSessions),
    'meditate-minutes': totalMinutes(meditationSessions),
    'vitals-streak': calculateVitalsStreak(vitalsDates),
    'steps-streak': calculateStepsStreak(stepEntries),
    'steps-single-day': bestStepsDay?.steps ?? 0,
    'steps-lifetime': lifetimeSteps,
    'hydration-streak': calculateHydrationStreak(hydrationEntries),
    'hydration-lifetime': lifetimeHydrationL,
    'run-count': runs.length,
    'run-distance': lifetimeRunKm,
    'workouts-count': sessions.length,
  };
}

/** Evaluates the whole catalog against real current data, persists any
 *  tier newly crossed since the last evaluation, and returns every tier
 *  with its earned state and (for earned ones) real earned date — the
 *  single function both the Badges screen and the Hub tile call. */
export async function evaluateAllBadges(db: AppDb = getDb()): Promise<EvaluatedBadge[]> {
  const [currentValues, earned] = await Promise.all([computeCurrentValues(db), listEarnedBadges(db)]);
  const earnedAtById = new Map(earned.map((b) => [b.id, b.earnedAt]));

  const statuses = BADGE_GROUPS.flatMap((group) =>
    evaluateBadgeGroup(group, currentValues[group.id] ?? 0)
  );

  await Promise.all(
    statuses.filter((s) => s.earned && !earnedAtById.has(s.id)).map((s) => recordBadgeEarned(s.id, db))
  );

  // Re-read so a badge earned just now carries its real just-set
  // timestamp rather than null.
  const finalEarned = await listEarnedBadges(db);
  const finalEarnedAtById = new Map(finalEarned.map((b) => [b.id, b.earnedAt]));

  return statuses.map((s) => ({ ...s, earnedAt: finalEarnedAtById.get(s.id) ?? null }));
}
