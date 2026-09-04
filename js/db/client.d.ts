// Sidecar types for client.js (hand-written JS, untouched — see
// tsconfig.json). `AppDb` only declares the tables new TypeScript
// repositories actually touch; every other store is still read/written by
// its own plain-JS repository and doesn't need a type here.
import type { DexieTable } from './dexie-types.js';
import type { SleepLog } from '../features/sleep/types.js';
import type { EarnedBadge } from '../features/badges/types.js';

export interface AppDb {
  sleepLogs: DexieTable<SleepLog, string>;
  earnedBadges: DexieTable<EarnedBadge, string>;
}

export const DB_NAME: string;
export function createDb(name?: string): AppDb;
export function getDb(): AppDb;
