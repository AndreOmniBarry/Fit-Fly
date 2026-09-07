// A short, honest sentence describing a date's logged naps — the
// dashboard/history's "you also napped for X" copy, kept out of view
// code so it's directly testable, same "pure string function, no DOM"
// contract as format.ts.
import { formatDurationHM } from './format.js';
/** Total minutes across a set of naps — 0 for an empty/no-naps day,
 *  never null (a real, displayable amount, same "0 logged so far"
 *  contract as sumHydrationEntries/sumNapMinutes, duplicated here in
 *  minimal form so this module has no db-repository dependency). */
export function totalNapMinutes(naps) {
    return naps.reduce((total, nap) => total + (nap.durationMinutes ?? 0), 0);
}
/** null when nothing was napped that day — callers should hide the nap
 *  summary entirely rather than showing an empty/zero sentence, the same
 *  "absent, not a fabricated zero" convention debt/consistency use
 *  elsewhere in Sleep. Deliberately date-agnostic ("that day", not
 *  "today") since the same viewed-date dashboard/history flow that
 *  renders a night's own log also renders any past date via History —
 *  callers add their own "today"/date-specific framing around this. */
export function describeNapsForDate(naps) {
    if (naps.length === 0)
        return null;
    const minutes = totalNapMinutes(naps);
    if (naps.length === 1) {
        return `Also napped for ${formatDurationHM(minutes)} that day.`;
    }
    return `Also napped ${naps.length} times that day, ${formatDurationHM(minutes)} total.`;
}
//# sourceMappingURL=nap-summary.js.map