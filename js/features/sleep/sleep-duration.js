// Turns a wake-up date plus two "HH:MM" clock-time inputs (from native
// <input type="time"> fields) into the wall-clock-encoded ISO pair this
// feature stores (see types.ts) and the duration between them. Pure and
// testable — no Date.now(), no I/O.
function toIso(dateStr, hours, minutes) {
    return new Date(Date.UTC(...parseDateParts(dateStr), hours, minutes)).toISOString();
}
function parseDateParts(dateStr) {
    const parts = dateStr.split('-').map(Number);
    const [year, month, day] = parts;
    if (parts.length !== 3 || [year, month, day].some((n) => n == null || Number.isNaN(n))) {
        throw new Error(`sleep-duration: invalid date "${dateStr}"`);
    }
    return [year, month - 1, day];
}
function parseClock(clockStr) {
    const [hoursStr, minutesStr] = clockStr.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        throw new Error(`sleep-duration: invalid clock time "${clockStr}"`);
    }
    return { hours, minutes };
}
function addDaysToDateString(dateStr, days) {
    const [year, monthIndex, day] = parseDateParts(dateStr);
    const d = new Date(Date.UTC(year, monthIndex, day + days));
    return d.toISOString().slice(0, 10);
}
/**
 * @param wakeDate The log's date (YYYY-MM-DD) — the morning being logged.
 * @param bedTimeClock "HH:MM", 24-hour.
 * @param wakeTimeClock "HH:MM", 24-hour.
 *
 * A bedtime clock hour before noon is treated as having happened after
 * midnight on `wakeDate` itself (e.g. a 00:30 bedtime the same calendar
 * night as a 7:00 wake); a bedtime at or after noon is treated as the
 * previous evening — the ordinary case.
 */
export function computeSleepLogTimes(wakeDate, bedTimeClock, wakeTimeClock) {
    const bed = parseClock(bedTimeClock);
    const wake = parseClock(wakeTimeClock);
    const bedDate = bed.hours < 12 ? wakeDate : addDaysToDateString(wakeDate, -1);
    const bedTime = toIso(bedDate, bed.hours, bed.minutes);
    const wakeTime = toIso(wakeDate, wake.hours, wake.minutes);
    // bedDate above already threads the correct calendar day through, so
    // this difference is the real elapsed time — no further wraparound
    // correction needed. A non-positive result means the caller passed
    // times that don't describe a real night (validated before saving).
    const durationMinutes = Math.round((Date.parse(wakeTime) - Date.parse(bedTime)) / 60_000);
    return { bedTime, wakeTime, durationMinutes };
}
//# sourceMappingURL=sleep-duration.js.map