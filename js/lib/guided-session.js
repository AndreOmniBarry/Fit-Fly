// Shared types and beat-builders for a guided session — pulled out of
// Focus's own guided-sessions.ts so Meditate's session library (and any
// future one) reuses the exact same word-count-based pacing math instead
// of a second copy of it. The player itself (js/features/focus/guided-
// session-view.ts) is the other reusable half — see its own doc comment.
const WORDS_PER_MINUTE = 145; // a measured, unhurried guided-session speaking pace — slower than conversational
const MIN_PROSE_BEAT_SECONDS = 3.5;
/** Sizes a prose beat's duration from its word count, with a floor so
 *  even a short line holds long enough to read and settle into. */
export function proseBeat(text, extraPauseSeconds = 1) {
    const words = text.trim().split(/\s+/).length;
    const speakingSeconds = (words / WORDS_PER_MINUTE) * 60;
    return { text, durationSeconds: Math.max(MIN_PROSE_BEAT_SECONDS, speakingSeconds + extraPauseSeconds) };
}
export function breathBeat(text, phase, durationSeconds) {
    return { text, durationSeconds, breathPhase: phase };
}
export function totalDurationSeconds(session) {
    return session.beats.reduce((sum, beat) => sum + beat.durationSeconds, 0);
}
//# sourceMappingURL=guided-session.js.map