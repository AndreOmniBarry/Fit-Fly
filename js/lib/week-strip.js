// A shared "last 7 real calendar days" recap strip — one cell per day,
// lit at full accent strength when that day's real logged total met the
// goal, dimmed when it was logged but fell short, and left as a bare
// outline when nothing was logged at all that day (never a fabricated
// zero standing in for "no entry"). Steps' and Hydration's own gamified
// week strips both build on this one shared primitive instead of each
// re-deriving the same date-window walk — same "shared primitive, not
// another duplicate" call as streak.ts.
import { iconMarkup } from './icons.js';
/** Builds the last `days` calendar days (oldest to newest, ending today)
 *  from two real date sets the caller already computed — which dates
 *  have any logged entry, and which of those met that day's goal. Pure:
 *  no I/O, so it's trivially unit-testable against a fixed `today`. */
export function buildWeekStrip(loggedDates, goalMetDates, today = new Date(), days = 7) {
    const todayIso = today.toISOString().slice(0, 10);
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        result.push({
            date: iso,
            hasEntry: loggedDates.has(iso),
            goalMet: goalMetDates.has(iso),
            isToday: iso === todayIso,
        });
    }
    return result;
}
function clearChildren(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
}
/** Renders `days` into `container` (an otherwise-empty element) as a row
 *  of small icon cells — reused by Steps (footprints) and Hydration
 *  (droplets), each passing their own icon and accent custom property, so
 *  there's exactly one place this markup/behavior lives. Safe to call
 *  again any time the underlying data changes. */
export function renderWeekStrip(container, days, options) {
    clearChildren(container);
    container.classList.add('week-strip');
    container.style.setProperty('--week-strip-accent', `var(${options.accentVar})`);
    for (const day of days) {
        const cell = document.createElement('span');
        cell.className = 'week-strip-cell';
        if (day.goalMet)
            cell.classList.add('week-strip-cell--met');
        else if (day.hasEntry)
            cell.classList.add('week-strip-cell--logged');
        if (day.isToday)
            cell.classList.add('week-strip-cell--today');
        const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
        cell.setAttribute('aria-label', `${dateLabel}: ${day.goalMet ? 'goal met' : day.hasEntry ? 'logged, goal not met' : 'nothing logged'}`);
        cell.innerHTML = iconMarkup(options.icon, { size: 16 });
        container.append(cell);
    }
}
//# sourceMappingURL=week-strip.js.map