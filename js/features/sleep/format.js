// Display formatting for Sleep — pure string functions, no DOM.
/** 462 -> "7h 42m", 480 -> "8h", 45 -> "45m". */
export function formatDurationHM(minutes) {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours === 0)
        return `${mins}m`;
    if (mins === 0)
        return `${hours}h`;
    return `${hours}h ${mins}m`;
}
/** Reads the UTC hour/minute — see types.ts's SleepLog.bedTime doc comment
 *  on why that's the wall-clock-encoding contract, not a real UTC instant.
 *  "11:14p", "6:56a", "12:00a" (midnight), "12:00p" (noon). */
export function formatClockTime(isoDateTime) {
    const d = new Date(isoDateTime);
    const hours24 = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const period = hours24 < 12 ? 'a' : 'p';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${String(minutes).padStart(2, '0')}${period}`;
}
/** The 24-hour "HH:MM" string an <input type="time"> expects, read from
 *  the same UTC-encoded wall-clock convention as formatClockTime. */
export function formatTimeInputValue(isoDateTime) {
    const d = new Date(isoDateTime);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
//# sourceMappingURL=format.js.map