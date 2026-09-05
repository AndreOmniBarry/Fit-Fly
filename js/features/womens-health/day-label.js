// Pure date-formatting, deliberately separated from cycle-log-view.js's
// DOM wiring — no document/window touch here, just Intl-based label
// formatting shared across the calendar, log headings, and pregnancy
// due-date copy.

/** "Wed, Jan 15" (or "Wed, Jan 15, 2026" with withYear) from a plain
 *  YYYY-MM-DD date string. The T00:00:00 anchor is what keeps this
 *  reading as the calendar day it names rather than shifting a day
 *  earlier/later across timezones the way a bare `new Date(dateStr)`
 *  (parsed as UTC midnight) would. */
export function formatDayLabel(dateStr, { withYear = false } = {}) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(
    undefined,
    withYear
      ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' }
  );
}
