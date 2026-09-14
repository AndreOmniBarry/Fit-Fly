// Sidecar types for readiness.js (hand-written JS, untouched — see
// tsconfig.json). The transparent, rule-based readiness score itself is
// unchanged by its move into Sleep as "How today looks" (see
// js/features/sleep/sleep-view.ts) — only where it's shown moved, not how
// it's computed.
export interface ReadinessInput {
  sleepHours?: number | null;
  energyLevel?: number | null;
  sorenessLevel?: number | null;
  recentSessionCount?: number;
  sleepDebtMinutes?: number | null;
  /** A real Acute:Chronic Workload Ratio (see js/features/programs/
   *  training-load.js's calculateAcuteChronicWorkloadRatio) — when
   *  `ratio` is non-null this replaces recentSessionCount's crude
   *  fallback entirely. Omit, or pass its own `{ratio: null, ...}`
   *  result before a real week of history exists, to keep the
   *  recentSessionCount fallback. */
  acwr?: { ratio: number | null; category?: 'building' | 'sweet-spot' | 'high-risk' | null } | null;
  /** A real personal-baseline HRV deviation from js/features/heart-rate/
   *  hrv-baseline.js's calculateHrvBaselineDeviation, computed from actual
   *  logged BLE-strap RMSSD history. When `deviationPercent` is a real
   *  number it adds a new weighted `hrv` component and, once notable, its
   *  own reasoning line. Omit, or pass its own `{deviationPercent: null, ...}`
   *  result before a real personal baseline exists, to leave the score
   *  exactly as it was before this input existed. */
  hrvDeviation?: {
    deviationPercent: number | null;
    category?: 'below-baseline' | 'at-baseline' | 'above-baseline' | null;
  } | null;
}

export type ReadinessCategory = 'low' | 'moderate' | 'high';

export interface ReadinessResult {
  score: number;
  category: ReadinessCategory;
  reasoning: string[];
}

export function calculateReadiness(input: ReadinessInput): ReadinessResult | null;

export function readinessActionSuggestion(category: ReadinessCategory): string;
