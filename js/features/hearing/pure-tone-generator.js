// Real Web Audio pure-tone playback for the hearing screening test — a
// plain sine oscillator at an exact frequency, panned hard to one ear,
// with a short fade in/out (avoids the audible "click" a tone
// starting/stopping at a non-zero sample would otherwise produce, which
// could itself be mistaken for "hearing the tone"). `gain` is a 0-1
// fraction of this device's own output range, never a calibrated dB
// figure — see pure-tone-test.js's own module comment for why.

const FADE_SECONDS = 0.05;

let audioCtx = null;

/** Call from inside a real user-gesture handler (a click) before the
 *  first tone plays — same AudioContext-priming contract audio-cue.js's
 *  primeAudio() already uses. */
export function primeToneAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch {
    // best-effort only
  }
}

export function isPureToneSupported() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
}

/**
 * @param {object} options
 * @param {number} options.frequencyHz
 * @param {number} options.gain - 0-1, this device's own output range
 * @param {'left'|'right'} options.ear
 * @param {number} [options.durationSeconds]
 * @returns {(() => void)|null} a stop() callback to end the tone early, or
 *   null if tone playback isn't available at all.
 */
export function playPureTone({ frequencyHz, gain, ear, durationSeconds = 1.5 }) {
  try {
    if (!audioCtx) return null;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequencyHz;

    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain, now + FADE_SECONDS);
    envelope.gain.setValueAtTime(gain, now + durationSeconds - FADE_SECONDS);
    envelope.gain.linearRampToValueAtTime(0, now + durationSeconds);

    const panner = audioCtx.createStereoPanner();
    panner.pan.value = ear === 'left' ? -1 : 1;

    osc.connect(envelope).connect(panner).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + durationSeconds);

    return () => {
      try {
        osc.stop();
      } catch {
        // already stopped — fine
      }
    };
  } catch {
    return null;
  }
}
