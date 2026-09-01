// Pure calendar-grid math for the History screen — building the
// Sunday-first month grid (leading/trailing days from neighboring months
// so every row is a full week) and today/future classification. No I/O,
// no rendering — sleep-view.ts fetches the month's logs separately and
// joins them onto whatever this returns.

export interface CalendarDay {
  /** YYYY-MM-DD. */
  date: string;
  /** False for the leading/trailing days borrowed from the previous/next
   *  month to fill out the grid's first/last week. */
  inMonth: boolean;
  /** Strictly after today — can't be logged (yet). */
  isFuture: boolean;
  isToday: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateString(year: number, monthIndex0: number, day: number): string {
  const d = new Date(year, monthIndex0, day);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * @param year Full year, e.g. 2026.
 * @param monthIndex0 0-11 (January = 0), same convention as `Date`.
 * @param todayDate YYYY-MM-DD — injected rather than computed with `new
 *   Date()` here, so this stays pure and deterministic for tests; callers
 *   pass today's real local date.
 */
export function getMonthGridDays(year: number, monthIndex0: number, todayDate: string): CalendarDay[] {
  const firstOfMonth = new Date(year, monthIndex0, 1);
  const leadingBlanks = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const days: CalendarDay[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - leadingBlanks + 1; // 1-indexed day-of-month, can spill negative/past daysInMonth
    const date = toDateString(year, monthIndex0, dayNumber);
    days.push({
      date,
      inMonth: dayNumber >= 1 && dayNumber <= daysInMonth,
      isFuture: date > todayDate,
      isToday: date === todayDate,
    });
  }
  return days;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatMonthLabel(year: number, monthIndex0: number): string {
  return `${MONTH_NAMES[monthIndex0]} ${year}`;
}

/** The first/last calendar dates of a month, for range-querying that
 *  month's logs — YYYY-MM-DD, inclusive both ends. */
export function monthDateRange(year: number, monthIndex0: number): { start: string; end: string } {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  return {
    start: toDateString(year, monthIndex0, 1),
    end: toDateString(year, monthIndex0, daysInMonth),
  };
}
