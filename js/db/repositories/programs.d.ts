// Sidecar types for programs.js (hand-written JS, untouched — see
// tsconfig.json).
export type ProgramStatus = 'draft' | 'active' | 'archived';

export const PROGRAM_STATUS: { DRAFT: 'draft'; ACTIVE: 'active'; ARCHIVED: 'archived' };

export interface ProgramRecord {
  id: string;
  category: string;
  experienceLevel?: string;
  trainingFocus?: string | null;
  startedAt: string;
  status: ProgramStatus;
  createdAt: string;
  [key: string]: unknown;
}

export function createProgram(program: Partial<ProgramRecord>, db?: unknown): Promise<ProgramRecord>;
export function getProgram(id: string, db?: unknown): Promise<ProgramRecord | undefined>;
export function setProgramStatus(id: string, status: ProgramStatus, db?: unknown): Promise<void>;
export function getActiveProgram(
  category: string,
  trainingFocus?: string | null,
  db?: unknown
): Promise<ProgramRecord | undefined>;
export function listProgramsByCategory(category: string, db?: unknown): Promise<ProgramRecord[]>;
