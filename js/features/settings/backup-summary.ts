// Pure helpers, deliberately separated from settings-view.ts's DOM
// wiring — no document/window touch here, just filename/summary
// formatting around a real js/db/backup.js export.
import type { FitFlyBackup } from '../../db/backup.js';

export function todayFilenameStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function countRows(backup: FitFlyBackup): number {
  return Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
}
