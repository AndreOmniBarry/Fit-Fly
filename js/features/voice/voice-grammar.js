// A closed-grammar command matcher — a small, fixed, explicit list of
// recognized phrases, not open-ended NLU/AI parsing of arbitrary speech.
// That's a deliberate safety/predictability choice: every phrase this
// can ever match is listed right here, so what voice control can do is
// fully auditable, and a misheard word can never accidentally trigger
// something unintended that wasn't on the list.

export const VOICE_COMMANDS = Object.freeze([
  { id: 'go-home', phrases: ['go home', 'home', 'take me home'] },
  { id: 'start-rest-timer', phrases: ['start timer', 'start rest timer', 'start the timer', 'open rest timer'] },
  { id: 'log-activity', phrases: ['log activity', 'log an activity', 'log my activity'] },
  { id: 'start-run', phrases: ['start run', 'start a run', 'start running', 'go for a run'] },
  { id: 'show-run-history', phrases: ['run history', 'show run history', 'open run history', 'my runs'] },
  { id: 'show-program', phrases: ['show my program', 'show program', 'open my program', 'my program'] },
  { id: 'check-readiness', phrases: ['check readiness', 'check my readiness', 'readiness check'] },
  { id: 'open-nutrition', phrases: ['open nutrition', 'show nutrition', 'log food', 'log a meal', 'nutrition'] },
  { id: 'open-heart-rate', phrases: ['open heart rate', 'check heart rate', 'heart rate', 'check my heart rate'] },
  { id: 'open-cycle-tracker', phrases: ['open cycle tracker', 'cycle tracker', 'open my cycle tracker'] },
  { id: 'open-goals', phrases: ['open goals', 'show goals', 'my goals', 'goals'] },
  { id: 'open-sleep', phrases: ['open sleep', 'log sleep', 'log my sleep', 'sleep'] },
  { id: 'open-focus', phrases: ['open focus', 'start focus', 'focus'] },
  { id: 'open-meditate', phrases: ['open meditate', 'start meditate', 'start meditation', 'meditate', 'meditation'] },
  { id: 'open-vitals', phrases: ['open vitals', 'show vitals', 'check my vitals', 'vitals'] },
  { id: 'open-steps', phrases: ['open steps', 'show steps', 'my steps', 'start a walk'] },
  { id: 'open-hydration', phrases: ['open hydration', 'show hydration', 'log water', 'log a drink', 'hydration'] },
]);

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsOf(phrase) {
  return normalize(phrase).split(' ').filter(Boolean);
}

/** True if every word of `phraseWords` appears in `transcriptWords`, in
 *  the same relative order (not necessarily adjacent) — tolerant of a
 *  stray filler word ("um", "please", "hey") without accepting
 *  arbitrary unrelated text. */
function containsWordsInOrder(transcriptWords, phraseWords) {
  let i = 0;
  for (const word of transcriptWords) {
    if (word === phraseWords[i]) i++;
    if (i === phraseWords.length) return true;
  }
  return false;
}

/**
 * @param {string} transcript - raw speech-recognition output
 * @returns {{commandId: string, matchedPhrase: string}|null}
 */
export function matchVoiceCommand(transcript) {
  const normalizedTranscript = normalize(transcript ?? '');
  if (!normalizedTranscript) return null;
  const transcriptWords = normalizedTranscript.split(' ');

  // Exact-phrase pass first — the confident, unambiguous match.
  for (const command of VOICE_COMMANDS) {
    for (const phrase of command.phrases) {
      if (normalizedTranscript === normalize(phrase)) {
        return { commandId: command.id, matchedPhrase: phrase };
      }
    }
  }

  // A more lenient in-order-words pass for minor recognition artifacts
  // ("hey start the timer please"). If several phrases match, the
  // longest (most specific) one wins.
  let best = null;
  for (const command of VOICE_COMMANDS) {
    for (const phrase of command.phrases) {
      const phraseWords = wordsOf(phrase);
      if (!containsWordsInOrder(transcriptWords, phraseWords)) continue;
      if (!best || phraseWords.length > wordsOf(best.matchedPhrase).length) {
        best = { commandId: command.id, matchedPhrase: phrase };
      }
    }
  }
  return best;
}
