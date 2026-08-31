// A hand-written, minimal typed surface for the Dexie tables new TypeScript
// repositories touch — Dexie itself is vendored as plain, unminified-free
// JS (js/vendor/dexie.min.mjs) with no shipped .d.ts, so this declares only
// the handful of Table/Collection methods this codebase actually calls,
// not the whole Dexie API.

export interface DexieCollection<T> {
  reverse(): DexieCollection<T>;
  limit(n: number): DexieCollection<T>;
  toArray(): Promise<T[]>;
  sortBy(key: string): Promise<T[]>;
  first(): Promise<T | undefined>;
}

export interface DexieWhereClause<T> {
  equals(value: string | number): DexieCollection<T>;
  between(
    lower: string | number,
    upper: string | number,
    includeLower?: boolean,
    includeUpper?: boolean
  ): DexieCollection<T>;
}

export interface DexieTable<T, Key> {
  get(key: Key): Promise<T | undefined>;
  put(item: T): Promise<Key>;
  add(item: T): Promise<Key>;
  delete(key: Key): Promise<void>;
  orderBy(index: string): DexieCollection<T>;
  where(index: string): DexieWhereClause<T>;
  toArray(): Promise<T[]>;
}
