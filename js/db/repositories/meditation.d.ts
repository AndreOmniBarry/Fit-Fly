// Sidecar types for meditation.js (hand-written JS, untouched — see
// tsconfig.json).
export interface MeditationSessionEntry {
  id: number;
  sessionId: string;
  sessionName: string;
  durationSeconds: number;
  date: string; // 'YYYY-MM-DD'
  completedAt: string;
}

export function recordMeditationSession(input: {
  sessionId: string;
  sessionName: string;
  durationSeconds: number;
}): Promise<MeditationSessionEntry>;

export function listRecentMeditationSessions(limit?: number): Promise<MeditationSessionEntry[]>;
