// Sidecar types for category-assignments.js (hand-written JS, untouched —
// see tsconfig.json).
export interface CategoryAssignment {
  id: number;
  category: string;
  reasoning: string[];
  inputsSnapshot: Record<string, unknown>;
  trainingFocus: string | null;
  assignedAt: string;
}

export function recordCategoryAssignment(
  assignment: { category: string; reasoning: string[]; inputsSnapshot: Record<string, unknown>; trainingFocus?: string | null },
  db?: unknown
): Promise<CategoryAssignment>;
export function getLatestCategoryAssignment(db?: unknown): Promise<CategoryAssignment | undefined>;
export function listCategoryAssignments(db?: unknown): Promise<CategoryAssignment[]>;
