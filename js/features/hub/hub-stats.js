// Pure logic for the Hub's own "Your Stats" hero cards (Steps/Calories/
// Water/Sleep) — deliberately DOM-free, same "pure logic lives outside
// the view" convention as every other feature's own *-trend.ts. The one
// real judgment call here, worth stating explicitly: a calendar day with
// no logged Steps/Hydration entry really is an honest 0 (unlike Sleep,
// where a night nobody rated has no real score to show at all) — so
// trailingDailyTotals fills every day in the window, never skipping one,
// the opposite rule from Steps' own bucketDailyPoints trend chart (which
// only plots days that actually have an entry) — and the one
// trailingSleepScores follows too, for the same reason.
import { calculateSleepScore } from '../sleep/sleep-score.js';
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
/** Real trailing-week sleep scores — one point per night actually logged
 *  in the window, oldest first. A night nobody logged is skipped
 *  entirely, never zero-filled (the opposite rule from
 *  trailingDailyTotals above, and deliberately so — see this module's own
 *  doc comment). Each night is scored only against logs on-or-before its
 *  own date, capped to the trailing 14 most recent — the same
 *  no-future-data windowing Sleep's own dashboard uses
 *  (sleep-view.ts's scoreLogInContext), so a night viewed here scores
 *  exactly as it would have at the time. */
export function trailingSleepScores(logs, { days, endDate, age }) {
    const anchor = new Date(`${endDate}T00:00:00`);
    const startAnchor = new Date(anchor);
    startAnchor.setDate(anchor.getDate() - (days - 1));
    const startDate = formatDate(startAnchor);
    const sortedDesc = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const inWindow = sortedDesc.filter((log) => log.date >= startDate && log.date <= endDate);
    return inWindow
        .slice()
        .reverse()
        .map((log) => {
        const context = sortedDesc.filter((l) => l.date <= log.date).slice(0, 14);
        const result = calculateSleepScore(log, context, age);
        return { date: log.date, score: result.score, category: result.category };
    });
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