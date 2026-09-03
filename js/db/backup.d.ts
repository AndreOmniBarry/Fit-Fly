// Sidecar types for backup.js (hand-written JS, untouched — see
// tsconfig.json).
export interface FitFlyBackup {
  app: 'fit-fly';
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
  prefs: Record<string, string>;
}

export const BACKUP_VERSION: number;
export function exportBackup(): Promise<FitFlyBackup>;
export function importBackup(backup: unknown): Promise<void>;
