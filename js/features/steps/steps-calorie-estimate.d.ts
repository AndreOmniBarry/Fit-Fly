// Sidecar types for steps-calorie-estimate.js (hand-written JS,
// untouched — see tsconfig.json).
export interface CalorieEstimate {
  kcal: number;
  confidence: 'low' | 'medium';
  method: 'met-formula';
}

export function estimateStepsCalories(input: {
  steps: number;
  weightKg: number | undefined;
}): CalorieEstimate | null;
