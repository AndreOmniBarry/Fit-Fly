// Keeps the screen on during a GPS run — without it, most phones sleep
// the screen within a minute or two and geolocation updates stop
// arriving. Feature-detected and entirely best-effort: unsupported
// browsers (most desktop, older mobile) just don't get the behavior,
// rather than throwing.

let sentinel = null;

export async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return false;
    sentinel = await navigator.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock() {
  try {
    await sentinel?.release();
  } catch {
    // best-effort only
  } finally {
    sentinel = null;
  }
}

export function isWakeLockHeld() {
  return sentinel != null && !sentinel.released;
}
