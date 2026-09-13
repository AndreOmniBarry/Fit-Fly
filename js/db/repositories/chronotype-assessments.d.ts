// Sidecar types for chronotype-assessments.js (hand-written JS, untouched
// — see tsconfig.json).
import type { ChronotypeAnswers, ChronotypeCategory } from '../../features/chronotype/chronotype.js';

export interface ChronotypeAssessmentEntry {
  id: number;
  answers: ChronotypeAnswers;
  total: number;
  category: ChronotypeCategory;
  takenAt: string;
}

export function recordChronotypeAssessment(input: {
  answers: ChronotypeAnswers;
  total: number;
  category: ChronotypeCategory;
}, db?: unknown): Promise<ChronotypeAssessmentEntry>;

export function listRecentChronotypeAssessments(limit?: number, db?: unknown): Promise<ChronotypeAssessmentEntry[]>;
