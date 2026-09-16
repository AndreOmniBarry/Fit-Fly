// Pure "which locked badge is closest to earning" selection — the real
// data behind the Badges screen's "Next milestone" nudge. No formatting,
// no I/O: badges-view.ts turns the returned tier into display copy the
// same way it already does for every other locked-tier card.
import type { BadgeStatus } from './types.js';

/** The single locked badge with the highest real progress ratio
 *  (currentValue / threshold) — ties keep the catalog's own order (its
 *  first match), so the result is deterministic run to run. Returns null
 *  once every real badge is earned, never a fabricated "keep going" with
 *  nothing left to point at. */
/** A real 0-100 progress percentage for one tier — the same
 *  currentValue/threshold ratio closestLockedBadge compares, just
 *  rounded and clamped for display (a locked tier's currentValue never
 *  reaches threshold in practice, but the clamp keeps a per-card ring
 *  honest either way, never overdrawn past 100%). */
export function progressPercent(status: Pick<BadgeStatus, 'currentValue' | 'threshold'>): number {
  if (status.threshold <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((status.currentValue / status.threshold) * 100)));
}

export function closestLockedBadge(statuses: BadgeStatus[]): BadgeStatus | null {
  let best: BadgeStatus | null = null;
  let bestRatio = -Infinity;
  for (const status of statuses) {
    if (status.earned) continue;
    const ratio = status.threshold > 0 ? status.currentValue / status.threshold : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = status;
    }
  }
  return best;
}
