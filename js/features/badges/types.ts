// Shared Badges types — the on-disk record, the pure catalog shape, and
// the evaluated-status shape the view renders.
import type { IconName } from '../../lib/icons.js';

/** One row per badge id the person has actually earned, written once and
 *  never overwritten — `earnedAt` is when the app first noticed the real
 *  underlying data crossed the threshold (a Hub load or a Badges screen
 *  visit), not necessarily the exact instant it happened. This is an
 *  honest limit of a client that only evaluates on open, not a background
 *  service — the same "first noticed" caveat every other Hub-tile stat in
 *  this app already lives with. */
export interface EarnedBadge {
  id: string;
  earnedAt: string;
}

/** One tier within a badge group — e.g. "7-day streak" within Sleep's
 *  streak group. Tiers are always listed ascending by threshold. */
export interface BadgeTier {
  id: string;
  threshold: number;
  name: string;
}

/** A family of badges measuring the same real metric at increasing
 *  thresholds (e.g. Sleep's 3/7/30-day streak tiers) — one BadgeGroup per
 *  metric, not one per badge, so the metric-computation and the copy
 *  describing it are written once. */
export interface BadgeGroup {
  id: string;
  category: string;
  icon: IconName;
  /** What the number actually counts — used to build honest progress
   *  copy like "4 of 7 consecutive nights logged". */
  metricLabel: string;
  /** One line citing exactly what real, already-stored data this reads —
   *  never a vague "keep it up", the same reasoning-transparency rule
   *  Programs/Nutrition already hold to. */
  basis: string;
  tiers: BadgeTier[];
}

/** One tier, evaluated against a real current value. */
export interface BadgeStatus {
  id: string;
  name: string;
  category: string;
  icon: IconName;
  threshold: number;
  metricLabel: string;
  basis: string;
  earned: boolean;
  currentValue: number;
}
