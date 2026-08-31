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
  'show-program': () => byId('btn-home-program')?.click(),
  'check-readiness': () => byId('btn-home-readiness')?.click(),
});

const COMMAND_FEEDBACK = Object.freeze({
  'go-home': 'Going home',
  'start-rest-timer': 'Opening the rest timer',
  'log-activity': 'Opening activity log',
  'start-run': 'Opening run mode',
  'show-program': "Opening your program",
  'check-readiness': 'Opening readiness check-in',
});

const FEEDBACK_TIMEOUT_MS = 3000;

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

  function showFeedback(text) {
    byId('voice-feedback').textContent = text;
    byId('voice-feedback-wrap').hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      byId('voice-feedback-wrap').hidden = true;
    }, FEEDBACK_TIMEOUT_MS);
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
      showFeedback('Listening…');
    } catch {
      setListening(false);
    }
  });

  toggleBtn.hidden = false;
}
