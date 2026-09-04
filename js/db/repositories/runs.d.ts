// Sidecar types for runs.js (hand-written JS, untouched — see
// tsconfig.json).
export interface RunRecord {
  id: string;
  startedAt: string;
  distanceMeters: number;
  [key: string]: unknown;
}

export function saveCompletedRun(run: Partial<RunRecord>, db?: unknown): Promise<RunRecord>;
export function getRun(id: string, db?: unknown): Promise<RunRecord | undefined>;
export function listRecentRuns(limit?: number, db?: unknown): Promise<RunRecord[]>;
export function listAllRuns(db?: unknown): Promise<RunRecord[]>;
