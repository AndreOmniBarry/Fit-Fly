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
}

export type ReadinessCategory = 'low' | 'moderate' | 'high';

export interface ReadinessResult {
  score: number;
  category: ReadinessCategory;
  reasoning: string[];
}

export function calculateReadiness(input: ReadinessInput): ReadinessResult | null;

export function readinessActionSuggestion(category: ReadinessCategory): string;
