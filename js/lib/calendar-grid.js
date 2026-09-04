// Pure month-calendar-grid math — building a Sunday-first month grid
// (leading/trailing days from neighboring months so every row is a full
// week) and today/future classification. No I/O, no rendering — each
// caller fetches its own month's data separately and joins it onto
// whatever this returns. Pulled out of Sleep's own sleep-calendar.ts
// (its first user) once the Cycle Tracker needed the exact same day-grid
// math for its own calendar — same "shared primitive, not a second copy"
// discipline as js/lib/guided-session.ts.
function pad2(n) {
    return String(n).padStart(2, '0');
}
function toDateString(year, monthIndex0, day) {
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
export function getMonthGridDays(year, monthIndex0, todayDate) {
    const firstOfMonth = new Date(year, monthIndex0, 1);
    const leadingBlanks = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
    const days = [];
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
export function formatMonthLabel(year, monthIndex0) {
    return `${MONTH_NAMES[monthIndex0]} ${year}`;
}
/** The first/last calendar dates of a month, for range-querying that
 *  month's logs — YYYY-MM-DD, inclusive both ends. */
export function monthDateRange(year, monthIndex0) {
    const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
    return {
        start: toDateString(year, monthIndex0, 1),
        end: toDateString(year, monthIndex0, daysInMonth),
    };
}
//# sourceMappingURL=calendar-grid.js.map