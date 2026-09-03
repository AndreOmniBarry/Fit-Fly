import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { createCountdown, formatDuration } from '../../lib/timer.js';
import { playCompletionBeep, primeAudio, vibrateDevice } from '../../lib/audio-cue.js';

const DEFAULT_DURATION_S = 60;
// Purely a re-render cadence, not the time source — see js/lib/timer.js's
// header comment. A missed/delayed tick still shows the correct value the
// moment the next one does fire.
const POLL_MS = 250;

function byId(id) {
  return document.getElementById(id);
}

export function initRestTimerFeature() {
  const restScreen = byId('screen-rest-timer');
  const tilt = attachTilt(restScreen);
  restScreen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });

  let durationS = DEFAULT_DURATION_S;
  let timer = createCountdown(durationS * 1000);
  let pollHandle = null;
  let announcedFinished = false;

  function render() {
    byId('rest-display').textContent = formatDuration(timer.getRemainingMs());
    if (timer.isFinished() && !announcedFinished) {
      announcedFinished = true;
      onFinished();
    }
  }

  function setStatus(text, announceToScreenReaders = false) {
    byId('rest-status').textContent = text;
    if (announceToScreenReaders) byId('rest-status-live').textContent = text;
  }

  function startPolling() {
    stopPolling();
    pollHandle = setInterval(render, POLL_MS);
  }

  function stopPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = null;
  }

  function resetToReady() {
    timer.reset(durationS * 1000);
    announcedFinished = false;
    stopPolling();
    byId('btn-rest-toggle').textContent = 'Start';
    setStatus('Ready');
    render();
  }

  function onFinished() {
    stopPolling();
    setStatus('Rest complete!', true);
    byId('btn-rest-toggle').textContent = 'Start';
    playCompletionBeep();
    vibrateDevice();
  }

  const presetChips = initChipGroup(byId('rest-presets'), {
    initial: String(DEFAULT_DURATION_S),
    onChange: (value) => {
      durationS = Number(value);
      resetToReady();
    },
  });

  byId('btn-rest-custom-apply').addEventListener('click', () => {
    const customSeconds = Number(byId('rest-custom-seconds').value);
    if (!(customSeconds > 0)) return;
    durationS = customSeconds;
    presetChips.setValue(null); // no preset matches a custom value
    resetToReady();
  });

  byId('btn-rest-toggle').addEventListener('click', () => {
    primeAudio(); // inside this click's call stack, so audio can play later at completion
    if (timer.running) {
      timer.pause();
      byId('btn-rest-toggle').textContent = 'Resume';
      setStatus('Paused');
      stopPolling();
      return;
    }

    if (timer.isFinished()) {
      // "Start" after completion restarts from the full duration rather
      // than requiring an explicit Reset first — one tap either way.
      timer.reset(durationS * 1000);
      announcedFinished = false;
    }
    timer.start();
    byId('btn-rest-toggle').textContent = 'Pause';
    setStatus('Resting…');
    startPolling();
  });

  byId('btn-rest-reset').addEventListener('click', resetToReady);

  byId('btn-home-rest-timer').addEventListener('click', () => showScreen('screen-rest-timer'));
  byId('btn-rest-back').addEventListener('click', () => showScreen('screen-home'));

  // A backgrounded/throttled tab misses poll ticks, not correctness — see
  // js/lib/timer.js. This just forces one immediate re-render on return so
  // the display doesn't visibly lag for up to POLL_MS after switching back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });

  render();
}
