// Sidecar types for hydration-reminders.js (hand-written JS, untouched —
// see tsconfig.json).
export function hydrationNeedsReminder(
  lastReminderAtIso: string | null,
  nowMs: number,
  intervalMs: number
): boolean;
