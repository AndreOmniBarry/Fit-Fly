// Local (in-session) notifications via the Notification API. There's no
// server here to drive push notifications while the app is fully closed
// — that would need a backend + VAPID keys, which is exactly the kind of
// server dependency this on-device, no-account app deliberately doesn't
// have. What this *can* do, honestly: ask permission, and show a real
// system notification the moment something notification-worthy happens
// while the app is open (a goal achieved, a reminder check on load) —
// feature-detected and silently no-op everywhere it isn't available or
// permitted, never throwing into the caller.

export function isNotificationSupported() {
  return 'Notification' in window;
}

export function getNotificationPermission() {
  return isNotificationSupported() ? Notification.permission : 'unsupported';
}

/** Only actually prompts the browser's permission dialog the first time
 *  — a second call just returns the already-decided 'granted'/'denied'. */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function showNotification(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
