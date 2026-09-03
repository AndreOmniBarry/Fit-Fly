// Sidecar types for storage.js (hand-written JS, untouched — see
// tsconfig.json).
export function getPref(key: string, fallback?: string | null): string | null;
export function setPref(key: string, value: string): boolean;
export function listPrefs(): Record<string, string>;
export function restorePrefs(prefs: Record<string, string> | null | undefined): void;
