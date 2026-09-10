// A small, screen-agnostic "you just did something real" celebration —
// the one place a genuine in-session achievement (a newly earned badge,
// a fresh personal record) surfaces as a visible toast regardless of
// which screen happens to be open when the app notices it. Auto-
// dismissing, never blocking — same spirit as Hydration's own inline
// record toast (hydration-view.ts's triggerHydrationRecordCelebration),
// just promoted to a floating, always-reachable element (same "floats
// above every screen" pattern as the Stopwatch FAB and the voice-control
// button in index.html) since these fire from anywhere — the Hub noticing
// a badge, a run that just ended — rather than from one screen's own card.
const DISMISS_MS = 4500;
// Comfortably longer than one toast's own visible time so a second,
// queued toast never overlaps the first mid-animation.
const QUEUE_GAP_MS = 4800;
let dismissTimer = null;
function byId(id) {
    return document.getElementById(id);
}
/** Shows the shared floating toast with `title`/`body`, replacing
 *  whatever it was showing before. Silently does nothing if the toast's
 *  own markup isn't in the document (e.g. an older cached page) — same
 *  "never throw into the caller" rule js/lib/notifications.js holds to. */
export function showAchievementToast(title, body) {
    const toast = byId('app-achievement-toast');
    if (!toast)
        return;
    const titleEl = byId('app-achievement-toast-title');
    const bodyEl = byId('app-achievement-toast-body');
    if (titleEl)
        titleEl.textContent = title;
    if (bodyEl)
        bodyEl.textContent = body;
    toast.hidden = false;
    toast.classList.remove('is-active');
    // rAF, not a synchronous class toggle — same reason
    // triggerHydrationRecordCelebration replays its own animation this way:
    // toggling a class off then immediately back on in the same tick never
    // reliably restarts a CSS animation.
    requestAnimationFrame(() => toast.classList.add('is-active'));
    if (dismissTimer != null)
        clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
        toast.hidden = true;
        dismissTimer = null;
    }, DISMISS_MS);
}
/** Shows one toast per item in sequence, each getting its own full
 *  DISMISS_MS on screen before the next replaces it — used when more
 *  than one real achievement lands from the same check (e.g. two badge
 *  tiers crossed at once) so every one actually gets seen instead of
 *  the last call silently overwriting the others mid-animation. */
export function queueAchievementToasts(items) {
    items.forEach((item, index) => {
        setTimeout(() => showAchievementToast(item.title, item.body), index * QUEUE_GAP_MS);
    });
}
//# sourceMappingURL=achievement-toast.js.map