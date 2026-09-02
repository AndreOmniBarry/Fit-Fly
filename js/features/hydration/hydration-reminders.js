// A real "time to drink water" nudge, within what a browser actually
// allows without a server — same honest "check on open, no true
// background alarm" contract as Goals' own reminders.js, just interval-
// based (every few hours) instead of once-per-calendar-day, since a
// water reminder that only ever fires once a day isn't much of a
// reminder. This file is deliberately just pure, testable time math,
// decoupled from the Notification API and from storage — see
// js/lib/notifications.js for the actual system-notification call, and
// hydration-view.js for how the two get wired together.

/**
 * @param {string|null} lastReminderAtIso an ISO timestamp, or null if
 *   there's never been one yet
 * @param {number} nowMs
 * @param {number} intervalMs how long to wait between reminders
 * @returns {boolean}
 */
export function hydrationNeedsReminder(lastReminderAtIso, nowMs, intervalMs) {
  if (!lastReminderAtIso) return true;
  const lastReminderMs = Date.parse(lastReminderAtIso);
  if (!Number.isFinite(lastReminderMs)) return true;
  return nowMs - lastReminderMs >= intervalMs;
}
