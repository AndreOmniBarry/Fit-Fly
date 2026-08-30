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
