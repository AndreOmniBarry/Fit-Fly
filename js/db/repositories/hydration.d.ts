// Sidecar types for hydration.js (hand-written JS, untouched — see
// tsconfig.json).
export interface HydrationEntry {
  id: string;
  date: string;
  amountMl: number;
  loggedAt: string;
}

export function addHydrationEntry(input: { amountMl: number; date?: string }): Promise<HydrationEntry>;
export function listHydrationEntriesForDate(date?: string): Promise<HydrationEntry[]>;
export function listHydrationEntriesInRange(startDate: string, endDate: string): Promise<HydrationEntry[]>;
export function listRecentHydrationEntries(limit?: number): Promise<HydrationEntry[]>;
export function deleteHydrationEntry(id: string): Promise<void>;
export function sumHydrationEntries(entries: { amountMl?: number | null }[]): number;
