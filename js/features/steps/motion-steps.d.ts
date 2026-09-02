// Sidecar types for motion-steps.js (hand-written JS, untouched — see
// tsconfig.json).
export function isMotionSensingAvailable(): boolean;

export function startStepCounting(callbacks: {
  onStepCount?: (stepCount: number) => void;
  onError?: (error: Error) => void;
}): { stop: () => void } | null;
