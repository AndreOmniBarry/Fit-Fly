// Real guided-session scripts — not filler copy. Each is built on an
// established, well-documented technique (cited in its own doc comment
// below), kept short (1-3 minutes), and written in plain, warm language
// with no diagnostic or clinical framing anywhere — these offer a
// technique, they never suggest a reason someone might need one.
//
// A session is an ordered list of "beats" — one line of guidance each,
// shown as an on-screen caption and (when available) spoken aloud. Every
// beat carries its own exact duration rather than leaving pacing to
// however long text-to-speech happens to take, for two reasons: a
// breathing exercise has to be metronomic regardless of voice/engine
// speed, and a caption needs a real duration to display even when speech
// synthesis isn't available at all (see voice-guide.ts).
//
// The types and beat-builders live in js/lib/guided-session.ts — shared
// with Meditate's own session library (js/features/meditate/
// meditations.ts) so both reuse the same word-count-based pacing math
// instead of a second copy of it.
import { breathBeat, proseBeat } from '../../lib/guided-session.js';
import type { GuidedSession, SessionBeat } from '../../lib/guided-session.js';

export type { GuidedSession, SessionBeat };

/** Box breathing (4-4-4-4) — equal-count inhale/hold/exhale/hold, the
 *  technique taught to Navy combat controllers for fast, reliable
 *  physiological calming before a high-stakes task. Six full cycles,
 *  ~2 minutes. */
function buildBreathingFocus(): GuidedSession {
  const cycle = [
    breathBeat('Breathe in', 'in', 4),
    breathBeat('Hold', 'hold', 4),
    breathBeat('Breathe out', 'out', 4),
    breathBeat('Hold', 'holdEmpty', 4),
  ];
  const beats: SessionBeat[] = [
    proseBeat('Get comfortable, and let your breathing settle for a moment.', 1.5),
    proseBeat("We'll breathe in a simple four-part pattern. Follow the ring.", 1),
  ];
  for (let i = 0; i < 6; i++) beats.push(...cycle);
  beats.push(proseBeat('Good. Let your breath return to normal, in your own time.', 1.5));
  return {
    id: 'breathing-focus',
    name: 'Breathing Focus',
    description: 'Box breathing — four equal counts, in, hold, out, hold.',
    basis: 'Box breathing (4-4-4-4), a standard fast-acting breath-pacing technique.',
    beats,
  };
}

/** A brief progressive muscle relaxation pass (Jacobson's technique) —
 *  deliberately short: three muscle groups, not the full-body version,
 *  so it fits in ~3 minutes. Real tense-and-release, not just "relax". */
function buildRelax(): GuidedSession {
  const beats: SessionBeat[] = [
    proseBeat("Find a position where you can let your weight settle fully — chair, floor, wherever you are.", 1.5),
    proseBeat("We'll tense a few muscles on purpose, then let them go. That release is the point.", 1.5),
    proseBeat('Start with your shoulders. Raise them up toward your ears, and hold.', 3),
    proseBeat('Now let them drop, completely. Notice the difference.', 3),
    proseBeat('Next, your hands. Make a fist with each one, and hold.', 3),
    proseBeat('Let them open, fingers loose. Let that heaviness sit there.', 3),
    proseBeat('Now your face — scrunch it up, eyes, jaw, everything, and hold.', 3),
    proseBeat('And release. Let your jaw hang slightly open if that feels right.', 3),
    proseBeat('One more time, everything at once — shoulders, hands, face — hold it.', 4),
    proseBeat('And let it all go. Just notice how much lighter that feels.', 2.5),
    proseBeat("That's the whole thing. Carry that looseness with you as long as it lasts.", 2),
  ];
  return {
    id: 'relax',
    name: 'Relax',
    description: 'A short progressive muscle relaxation pass — tense, then release.',
    basis: "Progressive muscle relaxation (Jacobson's technique), abbreviated to three muscle groups.",
    beats,
  };
}

/** A 5-4-3-2-1 grounding exercise — a well-established attention-anchoring
 *  technique, framed here plainly as a way to arrive and settle before
 *  focused work, with no clinical language attached to it. */
function buildFocusSession(): GuidedSession {
  const beats: SessionBeat[] = [
    proseBeat("Let's spend a minute arriving, before you start.", 1),
    proseBeat('Look around, and notice five things you can see.', 4),
    proseBeat('Now notice four things you can hear.', 4),
    proseBeat('Three things you can feel — the chair, the floor, your own hands.', 4),
    proseBeat('Two things you can smell, or just notice their absence.', 3.5),
    proseBeat('And one thing you can taste, right now.', 3),
    proseBeat("That's it — you're here. Take that with you into what's next.", 2),
  ];
  return {
    id: 'focus',
    name: 'Focus',
    description: 'A brief grounding exercise to arrive before you start.',
    basis: '5-4-3-2-1 sensory grounding, a standard attention-anchoring technique.',
    beats,
  };
}

/** A short guided body scan for winding down — feet to head, releasing
 *  tension along the way. Pairs naturally with Sleep's own Wind Down
 *  breathing pacer, as a longer, narrated alternative. */
function buildSleepFocus(): GuidedSession {
  const beats: SessionBeat[] = [
    proseBeat('Settle into bed, and let your eyes close if that feels right.', 2),
    proseBeat("We'll move attention slowly from your feet up to your head.", 1.5),
    proseBeat('Start with your feet. Just notice them — no need to change anything.', 3.5),
    proseBeat('Let that awareness rise into your calves and knees. Let them get heavy.', 3.5),
    proseBeat('Now your thighs and hips, sinking into whatever is underneath you.', 3.5),
    proseBeat('Your stomach and lower back, rising and falling with your breath.', 3.5),
    proseBeat('Your chest and shoulders — let them drop, away from your ears.', 3.5),
    proseBeat('Down through your arms, to your hands. Let your fingers uncurl.', 3.5),
    proseBeat('Your neck and jaw, soft. Your forehead, smooth.', 3),
    proseBeat("Your whole body now, heavy and still. There's nowhere else to be.", 3),
    proseBeat("If your mind wanders, that's fine — just come back to your breath.", 3),
  ];
  return {
    id: 'sleep-focus',
    name: 'Sleep Focus',
    description: 'A guided body scan, feet to head, to wind down for sleep.',
    basis: 'A standard progressive body-scan, the common technique behind most sleep-focused meditations.',
    beats,
  };
}

export const GUIDED_SESSIONS: readonly GuidedSession[] = Object.freeze([
  buildBreathingFocus(),
  buildRelax(),
  buildFocusSession(),
  buildSleepFocus(),
]);

export function getGuidedSession(id: string): GuidedSession | undefined {
  return GUIDED_SESSIONS.find((s) => s.id === id);
}

export { totalDurationSeconds } from '../../lib/guided-session.js';
