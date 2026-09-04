// Sidecar types for sessions.js (hand-written JS, untouched — see
// tsconfig.json).
export interface SessionRecord {
  id: string;
  startedAt: string;
  type: string;
  programId?: string;
  [key: string]: unknown;
}

export interface SetRecord {
  id: number;
  sessionId: string;
  exerciseId?: string;
  completedAt: string;
  [key: string]: unknown;
}

export function createSession(
  session: Partial<SessionRecord> & { sets?: Partial<SetRecord>[] },
  db?: unknown
): Promise<SessionRecord>;
export function getSession(id: string, db?: unknown): Promise<SessionRecord | undefined>;
export function addSet(sessionId: string, set: Partial<SetRecord>, db?: unknown): Promise<SetRecord>;
export function listSetsForSession(sessionId: string, db?: unknown): Promise<SetRecord[]>;
export function listSetsForExercise(exerciseId: string, db?: unknown): Promise<SetRecord[]>;
export function listSessionsByType(type: string, db?: unknown): Promise<SessionRecord[]>;
export function listRecentSessions(limit?: number, db?: unknown): Promise<SessionRecord[]>;
export function listAllSessions(db?: unknown): Promise<SessionRecord[]>;
