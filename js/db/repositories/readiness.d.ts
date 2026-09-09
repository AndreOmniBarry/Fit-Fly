// Sidecar types for readiness.js (hand-written JS, untouched — see
// tsconfig.json). Readiness's own storage — date-keyed, one check-in per
// day, same shape whether it's saved from Sleep's "How today looks" card
// (js/features/sleep/sleep-view.ts) or read back by My Program's banner
// (js/features/programs/program-view.js).
export interface ReadinessCheckin {
  date: string;
  sleepHours: number | null;
  energyLevel: number | null;
  sorenessLevel: number | null;
  recentSessionCount: number;
  score: number;
  category: 'low' | 'moderate' | 'high';
  checkedAt: string;
}

export function saveReadinessCheckin(
  checkin: Omit<ReadinessCheckin, 'checkedAt'>,
  db?: unknown
): Promise<ReadinessCheckin>;

export function getReadinessCheckinForDate(date: string, db?: unknown): Promise<ReadinessCheckin | undefined>;

export function listRecentReadinessCheckins(limit?: number, db?: unknown): Promise<ReadinessCheckin[]>;
