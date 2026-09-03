// Thin wrapper around localStorage: private browsing / disabled storage
// throws on some browsers, and this app must never crash because a
// preference couldn't be saved.

const PREFIX = 'fitfly:';

export function getPref(key, fallback = null) {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

/** Every stored preference, unprefixed — used by js/db/backup.js to fold
 *  prefs into a full on-device export alongside the Dexie tables. Reads
 *  localStorage directly rather than tracking a key registry, so a new
 *  setPref() call anywhere in the app is automatically included with no
 *  second list to maintain. */
export function listPrefs() {
  try {
    const prefs = {};
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey?.startsWith(PREFIX)) {
        prefs[fullKey.slice(PREFIX.length)] = localStorage.getItem(fullKey);
      }
    }
    return prefs;
  } catch {
    return {};
  }
}

/** The other half of listPrefs() — restores a full set of prefs from a
 *  backup. Best-effort per key, same as setPref(). */
export function restorePrefs(prefs) {
  for (const [key, value] of Object.entries(prefs ?? {})) {
    if (typeof value === 'string') setPref(key, value);
  }
}
