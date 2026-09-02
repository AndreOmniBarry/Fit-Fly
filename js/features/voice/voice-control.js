import { showScreen } from '../../lib/router.js';
import { matchVoiceCommand } from './voice-grammar.js';

function byId(id) {
  return document.getElementById(id);
}

function getSpeechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Every command jumps straight to its screen by simulating the click on
// that feature's own home-dashboard entry button — reusing the exact
// same async setup (fetching profile/program/history before rendering)
// that a real tap already does, rather than a second, easily-drifting
// copy of that logic here. Voice control can reach any of these from
// any screen, not just from home — the button is hidden, not absent.
const COMMAND_ACTIONS = Object.freeze({
  'go-home': () => showScreen('screen-hub'),
  'start-rest-timer': () => byId('btn-home-rest-timer')?.click(),
  'log-activity': () => byId('btn-home-log-activity')?.click(),
  'start-run': () => byId('btn-home-run')?.click(),
  'show-run-history': () => byId('btn-home-run-history')?.click(),
  'show-program': () => byId('btn-home-program')?.click(),
  'check-readiness': () => byId('btn-home-readiness')?.click(),
  'open-nutrition': () => byId('btn-home-nutrition')?.click(),
  'open-heart-rate': () => byId('btn-home-heart-rate')?.click(),
  'open-cycle-tracker': () => byId('btn-home-womens-health')?.click(),
  'open-goals': () => byId('btn-home-goals')?.click(),
  'open-sleep': () => byId('btn-home-sleep')?.click(),
  'open-focus': () => byId('btn-home-focus')?.click(),
  'open-meditate': () => byId('btn-home-meditate')?.click(),
  'open-vitals': () => byId('btn-home-vitals')?.click(),
  'open-steps': () => byId('btn-home-steps')?.click(),
  'open-hydration': () => byId('btn-home-hydration')?.click(),
});

const COMMAND_FEEDBACK = Object.freeze({
  'go-home': 'Going home',
  'start-rest-timer': 'Opening the rest timer',
  'log-activity': 'Opening activity log',
  'start-run': 'Opening run mode',
  'show-run-history': 'Opening run history',
  'show-program': "Opening your program",
  'check-readiness': 'Opening readiness check-in',
  'open-nutrition': 'Opening nutrition',
  'open-heart-rate': 'Opening heart rate',
  'open-cycle-tracker': 'Opening cycle tracker',
  'open-goals': 'Opening goals',
  'open-sleep': 'Opening Sleep',
  'open-focus': 'Opening Focus',
  'open-meditate': 'Opening Meditate',
  'open-vitals': 'Opening Vitals',
  'open-steps': 'Opening Steps',
  'open-hydration': 'Opening Hydration',
});

// Shown while listening so a first-time (or forgetful) user has somewhere
// to look, rather than a bare mic icon with no indication of what it
// understands — a fixed, small sample, not the full list (there isn't
// room, and it isn't necessary — any phrase from VOICE_COMMANDS works).
const EXAMPLE_PHRASES = ['"log activity"', '"start a run"', '"open nutrition"', '"go home"'];

const FEEDBACK_TIMEOUT_MS = 4000;

export function initVoiceFeature() {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  const toggleBtn = byId('btn-voice-toggle');

  if (!SpeechRecognitionClass) {
    toggleBtn.hidden = true; // no feature-detection fallback needed — just don't offer it
    return;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let listening = false;
  let feedbackTimer = null;

  function setListening(value) {
    listening = value;
    toggleBtn.setAttribute('aria-pressed', String(value));
  }

  /** `hint`, when given, renders as a small example-phrase line under the
   *  main message — only used for "Listening…", where someone genuinely
   *  needs to know what to say. Every bubble also gets a real dismiss
   *  button: the previous version only ever went away on its own after a
   *  few seconds, with no way to close it sooner — the exact "it won't
   *  leave" complaint this fixes. */
  function showFeedback(text, hint) {
    byId('voice-feedback-text').textContent = text;
    const hintEl = byId('voice-feedback-hint');
    hintEl.textContent = hint ?? '';
    hintEl.hidden = !hint;
    byId('voice-feedback-wrap').hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(hideFeedback, FEEDBACK_TIMEOUT_MS);
  }

  function hideFeedback() {
    clearTimeout(feedbackTimer);
    byId('voice-feedback-wrap').hidden = true;
  }

  function handleTranscript(transcript) {
    const match = matchVoiceCommand(transcript);
    if (!match) {
      showFeedback(`Heard "${transcript}" — no matching command.`);
      return;
    }
    showFeedback(COMMAND_FEEDBACK[match.commandId] ?? 'Done');
    COMMAND_ACTIONS[match.commandId]?.();
  }

  recognition.addEventListener('result', (event) => {
    const lastResult = event.results[event.results.length - 1];
    handleTranscript(lastResult[0].transcript);
  });
  recognition.addEventListener('end', () => setListening(false));
  recognition.addEventListener('error', () => {
    setListening(false);
    showFeedback('Didn\'t catch that — try again.');
  });

  toggleBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      setListening(true);
      showFeedback('Listening…', `Try: ${EXAMPLE_PHRASES.join(', ')}`);
    } catch {
      setListening(false);
    }
  });

  byId('btn-voice-feedback-dismiss').addEventListener('click', hideFeedback);

  toggleBtn.hidden = false;
}
