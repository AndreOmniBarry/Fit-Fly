function pad2(n) {
    return String(n).padStart(2, '0');
}
function formatDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** Exactly `days` trailing calendar days ending at `endDate` (inclusive),
 *  oldest first — a day with no matching entries is a real, honest 0,
 *  not a gap. `entries` can be any records carrying a `date` and however
 *  many should count toward that date's total (already-filtered to
 *  whatever range the caller wants included). */
export function trailingDailyTotals(entries, { days, endDate }) {
    const totalsByDate = new Map();
    for (const entry of entries) {
        totalsByDate.set(entry.date, (totalsByDate.get(entry.date) ?? 0) + entry.value);
    }
    const anchor = new Date(`${endDate}T00:00:00`);
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(anchor);
        d.setDate(anchor.getDate() - i);
        const date = formatDate(d);
        result.push({ date, value: totalsByDate.get(date) ?? 0 });
    }
    return result;
}
/** A plain, honest local-time-of-day greeting — the only "personalization"
 *  this app invents, since it's derived from the device clock rather than
 *  fabricated. `hour` is 0-23, local. */
export function greetingForHour(hour) {
    if (hour < 5)
        return { period: 'night', text: 'Good night' };
    if (hour < 12)
        return { period: 'morning', text: 'Good morning' };
    if (hour < 17)
        return { period: 'afternoon', text: 'Good afternoon' };
    if (hour < 21)
        return { period: 'evening', text: 'Good evening' };
    return { period: 'night', text: 'Good night' };
}
/** "2.51 km" style compact distance for the Steps hero card — shorter
 *  than steps-distance-estimate.ts's own formatStepsDistance (a full
 *  sentence meant for its own screen), same underlying meters value. */
export function formatHeroDistanceKm(meters) {
    if (meters >= 1000)
        return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
}
//# sourceMappingURL=hub-stats.js.map