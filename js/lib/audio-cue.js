// A short synthesized completion beep (Web Audio oscillator, no audio
// file to fetch) plus best-effort device vibration. Both are entirely
// best-effort: browsers require a user gesture to start audio playback,
// and most desktop browsers (and iOS Safari, at all) don't implement the
// Vibration API — every call here is wrapped so a missing/blocked API
// never throws into the caller.

let audioCtx = null;

/** Call this from inside a real user-gesture handler (a click) — creating
 *  or resuming the AudioContext here is what lets playCompletionBeep()
 *  actually produce sound later, even though completion fires
 *  asynchronously and isn't itself a gesture. */
export function primeAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch {
    // best-effort only
  }
}

export function playCompletionBeep() {
  try {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch {
    // best-effort only
  }
}

export function vibrateDevice(pattern = [200, 100, 200]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // best-effort only
  }
}
