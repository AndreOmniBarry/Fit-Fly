// Sidecar types for steps.js (hand-written JS, untouched — see
// tsconfig.json).
export const STEP_SOURCE: Readonly<{ MANUAL: 'manual'; SENSOR: 'sensor'; NATIVE_PEDOMETER: 'native-pedometer' }>;

export interface StepEntry {
  date: string;
  steps: number;
  source: 'manual' | 'sensor' | 'native-pedometer';
  updatedAt: string;
}

export function addStepsToDate(steps: number, date?: string): Promise<StepEntry>;
export function setStepsForDate(steps: number, date?: string): Promise<StepEntry>;
export function syncStepsFromNativePedometer(steps: number, date?: string): Promise<StepEntry>;
export function getStepEntryForDate(date?: string): Promise<StepEntry | undefined>;
export function listRecentStepEntries(limit?: number): Promise<StepEntry[]>;
export function listAllStepEntries(db?: unknown): Promise<StepEntry[]>;
