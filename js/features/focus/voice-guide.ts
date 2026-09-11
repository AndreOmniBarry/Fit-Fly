// Free, on-device voice guidance for guided sessions — the browser's
// built-in Web Speech Synthesis API. No account, no API key, no per-call
// cost, no external service to register with, no model download: every
// major browser ships real text-to-speech voices with the OS, spoken
// entirely locally. Feature-detected and defensive throughout, the same
// contract as every other Web API wrapper in this app (audio-cue.js,
// camera-ppg.js, ...): a missing or blocked implementation degrades to
// silence, never a thrown error — the on-screen caption (see
// guided-session-view.ts) carries the session either way, so voice
// guidance is a real enhancement, not a dependency.
//
// This used to sit beside a second engine — Kokoro-82M, a neural TTS
// model fetched from a CDN and run on-device. It's gone: it stayed
// unreliable on real devices (going silent mid-session even after a real,
// identified bug fix — an AudioContext that never confirmed 'running'
// before playback was reported as started) for long enough, across
// enough real-device reports, that the honest call was to remove it
// rather than defend a fix that couldn't be verified against the actual
// failures being reported. One engine, always on-device, always audible
// (feature-detection aside), no download, no CDN fetch, no second thing
// that can silently go wrong.
function getSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function isVoiceGuideSupported(): boolean {
  return getSpeechSynthesis() != null;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let preferredVoice: SpeechSynthesisVoice | null = null;
let voicesListenerAttached = false;

function refreshVoices(synth: SpeechSynthesis): void {
  cachedVoices = synth.getVoices();
  preferredVoice = null;
}

/** The voice list loads asynchronously in most browsers — an empty list
 *  on the very first call is normal, not unsupported; this listens once
 *  for it to actually arrive. */
function ensureVoicesLoading(synth: SpeechSynthesis): void {
  refreshVoices(synth);
  if (cachedVoices.length === 0 && !voicesListenerAttached) {
    voicesListenerAttached = true;
    synth.addEventListener('voiceschanged', () => refreshVoices(synth));
  }
}

// Every platform that ships real neural/enhanced on-device (or
// vendor-bundled, still free, still no account or API key) voices names
// them this way in the voice list — "Microsoft ... Online (Natural)" on
// Windows/Edge, "... (Enhanced)"/"(Premium)" on macOS/iOS, "... Neural"
// on some Android/Chrome builds. Favoring these over the previous
// localService-only heuristic is what actually gets a materially better
// voice where the platform offers one, still entirely within the Web
// Speech API's free, on-device (or same-origin-free, browser-bundled)
// contract — no separate paid service, no registration.
const QUALITY_NAME_HINTS = ['natural', 'neural', 'enhanced', 'premium', 'wavenet'];

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (QUALITY_NAME_HINTS.some((hint) => name.includes(hint))) return 2;
  if (voice.localService) return 1;
  return 0;
}

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;
  if (cachedVoices.length === 0) ensureVoicesLoading(synth);
  const english = cachedVoices.filter((v) => v.lang.startsWith('en'));
  const pool = english.length > 0 ? english : cachedVoices;
  preferredVoice = pool.reduce<SpeechSynthesisVoice | null>(
    (best, v) => (best == null || voiceQualityScore(v) > voiceQualityScore(best) ? v : best),
    null
  );
  return preferredVoice;
}

/** Splits a line at its natural pause points (commas, colons, semicolons,
 *  dashes, sentence breaks) so it can be spoken as a chain of shorter
 *  utterances rather than one flat pass — see speak()'s doc comment for
 *  why that's what actually fixes the cadence, not just the voice pick. */
function splitIntoClauses(text: string): string[] {
  const parts = text.match(/[^,;:—-]+[,;:—-]?/g) ?? [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

let chainToken = 0;

// A real, still-open Chromium bug (issues.chromium.org/issues/41294170):
// speechSynthesis.speak() on a non-local ("remote"/network) voice silently
// stalls after roughly 15 seconds of continuous speech unless something
// calls .pause()/.resume() to keep it alive — reported as still live as of
// Chrome 130. This app's own clause-chaining already keeps any *one*
// utterance short, but a long guided-session line splits into many
// clauses spoken back-to-back with only a short breath pause between them
// (see speak()'s own doc comment), so the *chain* as a whole can still run
// well past 15s. The workaround is exactly what Chromium's own bug
// tracker and multiple browser-vendor discussions confirm works: nudge a
// still-speaking synth with pause()/resume() well inside that window.
// Harmless everywhere else — Safari/Firefox never had this bug, and
// calling pause()/resume() on an already-fine synth is a documented no-op
// there, not a new failure mode.
const CHROME_STALL_KEEPALIVE_MS = 10000;
let keepaliveHandle: ReturnType<typeof setInterval> | null = null;

function startKeepalive(synth: SpeechSynthesis): void {
  if (keepaliveHandle != null) return; // already running for this chain
  keepaliveHandle = setInterval(() => {
    if (!synth.speaking) {
      stopKeepalive();
      return;
    }
    synth.pause();
    synth.resume();
  }, CHROME_STALL_KEEPALIVE_MS);
}

function stopKeepalive(): void {
  if (keepaliveHandle == null) return;
  clearInterval(keepaliveHandle);
  keepaliveHandle = null;
}

/** Speaks one line, cancelling whatever was still being said — a guided
 *  session's beats are meant to replace each other, never overlap.
 *
 *  A single SpeechSynthesisUtterance over a whole sentence is what makes
 *  browser TTS read as flat and "computer-voiced" — most engines don't
 *  reliably honor internal punctuation as a pause or pitch cue, so a
 *  multi-clause line comes out at one constant rate and pitch start to
 *  finish. Speaking it instead as a chain of per-clause utterances, each
 *  with a small natural rate variance and a real pitch drop on the final
 *  clause (the same "terminal declination" real speech uses to signal a
 *  thought ending, versus a slight lift on a clause that continues), with
 *  a short breath-length pause between them, is a genuine cadence
 *  improvement available from the free on-device API — not a different
 *  engine, just not asking one flat utterance to do a sentence's job. */
export function speak(text: string, { rate = 0.92, pitch = 1 }: { rate?: number; pitch?: number } = {}): void {
  try {
    const synth = getSpeechSynthesis();
    if (!synth) return;
    synth.cancel();
    const token = ++chainToken;
    const voice = pickVoice(synth);
    const clauses = splitIntoClauses(text);

    const speakClause = (i: number): void => {
      if (token !== chainToken) return; // superseded by a newer speak()/stopSpeaking() call
      const clause = clauses[i];
      if (clause == null) return;
      const isFinal = i === clauses.length - 1;
      const utterance = new SpeechSynthesisUtterance(clause);
      utterance.rate = rate + (Math.random() - 0.5) * 0.03; // a hair of natural rate variance, not a metronome
      utterance.pitch = isFinal ? pitch * 0.96 : pitch * 1.02;
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (token !== chainToken || isFinal) return;
        setTimeout(() => speakClause(i + 1), 90 + Math.random() * 60); // a real breath/comma pause, not silence-then-instant-next-word
      };
      synth.speak(utterance);
    };
    speakClause(0);
    startKeepalive(synth);
  } catch {
    // best-effort only — see module doc comment
  }
}

export function stopSpeaking(): void {
  try {
    chainToken++; // invalidate any in-flight clause chain before cancel() fires its own event
    getSpeechSynthesis()?.cancel();
  } catch {
    // best-effort only
  }
  stopKeepalive();
}
