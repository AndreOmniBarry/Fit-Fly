// Sidecar types for training-load.js (hand-written JS, untouched — see
// tsconfig.json). Foster session-RPE training load + Acute:Chronic
// Workload Ratio — see training-load.js's own doc comment for the real
// citations behind this.
import type { SessionRecord, SetRecord } from '../../db/repositories/sessions.js';

export type AcwrCategory = 'building' | 'sweet-spot' | 'high-risk';

export interface DailyTrainingLoad {
  date: string;
  load: number;
}

export interface AcuteChronicWorkloadRatio {
  acute: number | null;
  chronic: number | null;
  ratio: number | null;
  category: AcwrCategory | null;
  daysOfHistory: number;
}

export function sessionTrainingLoad(
  session: Pick<SessionRecord, 'sessionRpe'>,
  sets: Pick<SetRecord, 'completedAt'>[]
): number | null;

export function dailyTrainingLoadsFromSessions(
  sessionsWithSets: { session: SessionRecord; sets: SetRecord[] }[]
): DailyTrainingLoad[];

export function calculateAcuteChronicWorkloadRatio(
  dailyLoads: DailyTrainingLoad[],
  asOfDate: string
): AcuteChronicWorkloadRatio;
