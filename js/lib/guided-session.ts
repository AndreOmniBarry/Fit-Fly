// Shared types and beat-builders for a guided session — pulled out of
// Focus's own guided-sessions.ts so Meditate's session library (and any
// future one) reuses the exact same word-count-based pacing math instead
// of a second copy of it. The player itself (js/features/focus/guided-
// session-view.ts) is the other reusable half — see its own doc comment.

export interface SessionBeat {
  /** Shown as the caption, and spoken aloud when voice guidance is on. */
  text: string;
  /** Exactly how long this beat holds before advancing. */
  durationSeconds: number;
  /** A breathing phase, for the pacer visual to key its animation off of
   *  — undefined for beats that aren't part of a breathing cycle. */
  breathPhase?: 'in' | 'hold' | 'out' | 'holdEmpty';
}

export interface GuidedSession {
  id: string;
  name: string;
  /** One line, shown on the picker — states the technique plainly. */
  description: string;
  /** The technique this is built on, and why it's here — never shown in
   *  the product UI, just documentation for anyone maintaining this. */
  basis: string;
  beats: SessionBeat[];
}

const WORDS_PER_MINUTE = 145; // a measured, unhurried guided-session speaking pace — slower than conversational
const MIN_PROSE_BEAT_SECONDS = 3.5;

/** Sizes a prose beat's duration from its word count, with a floor so
 *  even a short line holds long enough to read and settle into. */
export function proseBeat(text: string, extraPauseSeconds = 1): SessionBeat {
  const words = text.trim().split(/\s+/).length;
  const speakingSeconds = (words / WORDS_PER_MINUTE) * 60;
  return { text, durationSeconds: Math.max(MIN_PROSE_BEAT_SECONDS, speakingSeconds + extraPauseSeconds) };
}

export function breathBeat(text: string, phase: SessionBeat['breathPhase'], durationSeconds: number): SessionBeat {
  return { text, durationSeconds, breathPhase: phase };
}

export function totalDurationSeconds(session: GuidedSession): number {
  return session.beats.reduce((sum, beat) => sum + beat.durationSeconds, 0);
}
