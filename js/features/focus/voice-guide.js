// Voice guidance for guided sessions. speak()/stopSpeaking() are the one
// surface every caller (guided-session-view.ts, Settings' Preview
// button) ever touches — which of two engines actually does the talking
// is decided in here, invisibly:
//
//   - Piper (piper-voice.ts): a real neural voice, on by default, lazily
//     warmed up in the background the first time speak() is ever called
//     for real (never blocking app startup on a ~100MB load).
//   - The browser's own built-in Web Speech Synthesis API, below: no
//     account, no download, no CDN, works on effectively every browser.
//     It's what speaks the very first line, every time, while Piper is
//     still warming up — a temporarily plainer voice beats a silent
//     caption — and it's the permanent fallback for the rest of a
//     session (or the app's whole lifetime) the moment Piper fails at
//     anything, init or mid-speech.
//
// This app already tried an on-device neural voice once — Kokoro-82M,
// fetched from a CDN — and it was removed outright after staying
// unreliable on real devices for too long, including after a real,
// identified bug fix (a hand-rolled AudioContext that could report a
// clip "started" before the context had actually confirmed 'running')
// that couldn't be verified against the actual failures being reported.
// Piper is built differently specifically to not repeat that: the model
// is vendored, not CDN-fetched (see js/vendor/THIRD_PARTY_NOTICES.md),
// and playback is a plain HTMLAudioElement, never AudioContext (see
// piper-voice.ts's own doc comment for why that whole bug class doesn't
// apply here) — but the fallback below still exists, on purpose, in
// case something about a real device this sandbox can't reproduce finds
// a new way for Piper to go quiet. A session is never silent because of
// either engine: feature-detection/init/inference/playback failure at
// any point degrades to the other engine or, at the very worst (no
// speechSynthesis and Piper unavailable), to the on-screen caption
// (guided-session-view.ts) that already carries the session regardless.
import { ensurePiperLoaded, isPiperReady, speakWithPiper, stopPiperSpeaking } from './piper-voice.js';
function getSpeechSynthesis() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}
export function isVoiceGuideSupported() {
    return getSpeechSynthesis() != null;
}
let cachedVoices = [];
let preferredVoice = null;
let voicesListenerAttached = false;
function refreshVoices(synth) {
    cachedVoices = synth.getVoices();
    preferredVoice = null;
}
/** The voice list loads asynchronously in most browsers — an empty list
 *  on the very first call is normal, not unsupported; this listens once
 *  for it to actually arrive. */
function ensureVoicesLoading(synth) {
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
function voiceQualityScore(voice) {
    const name = voice.name.toLowerCase();
    if (QUALITY_NAME_HINTS.some((hint) => name.includes(hint)))
        return 2;
    if (voice.localService)
        return 1;
    return 0;
}
function pickVoice(synth) {
    if (preferredVoice)
        return preferredVoice;
    if (cachedVoices.length === 0)
        ensureVoicesLoading(synth);
    const english = cachedVoices.filter((v) => v.lang.startsWith('en'));
    const pool = english.length > 0 ? english : cachedVoices;
    preferredVoice = pool.reduce((best, v) => (best == null || voiceQualityScore(v) > voiceQualityScore(best) ? v : best), null);
    return preferredVoice;
}
/** Splits a line at its natural pause points (commas, colons, semicolons,
 *  dashes, sentence breaks) so it can be spoken as a chain of shorter
 *  utterances rather than one flat pass — see speak()'s doc comment for
 *  why that's what actually fixes the cadence, not just the voice pick. */
function splitIntoClauses(text) {
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
let keepaliveHandle = null;
function startKeepalive(synth) {
    if (keepaliveHandle != null)
        return; // already running for this chain
    keepaliveHandle = setInterval(() => {
        if (!synth.speaking) {
            stopKeepalive();
            return;
        }
        synth.pause();
        synth.resume();
    }, CHROME_STALL_KEEPALIVE_MS);
}
function stopKeepalive() {
    if (keepaliveHandle == null)
        return;
    clearInterval(keepaliveHandle);
    keepaliveHandle = null;
}
/** Speaks one line on the Web Speech path, cancelling whatever was still
 *  being said — a guided session's beats are meant to replace each
 *  other, never overlap.
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
 *  engine, just not asking one flat utterance to do a sentence's job.
 *  (Piper needs none of this — see piper-voice.ts's doc comment — so this
 *  clause-chaining is only ever exercised on the fallback path now.) */
function speakWithWebSpeech(text, { rate = 0.92, pitch = 1 } = {}) {
    const synth = getSpeechSynthesis();
    if (!synth)
        return;
    synth.cancel();
    const token = ++chainToken;
    const voice = pickVoice(synth);
    const clauses = splitIntoClauses(text);
    const speakClause = (i) => {
        if (token !== chainToken)
            return; // superseded by a newer speak()/stopSpeaking() call
        const clause = clauses[i];
        if (clause == null)
            return;
        const isFinal = i === clauses.length - 1;
        const utterance = new SpeechSynthesisUtterance(clause);
        utterance.rate = rate + (Math.random() - 0.5) * 0.03; // a hair of natural rate variance, not a metronome
        utterance.pitch = isFinal ? pitch * 0.96 : pitch * 1.02;
        if (voice)
            utterance.voice = voice;
        utterance.onend = () => {
            if (token !== chainToken || isFinal)
                return;
            setTimeout(() => speakClause(i + 1), 90 + Math.random() * 60); // a real breath/comma pause, not silence-then-instant-next-word
        };
        synth.speak(utterance);
    };
    speakClause(0);
    startKeepalive(synth);
}
let piperWarmupStarted = false;
let piperBroken = false;
/** Kicks off Piper's load exactly once per page, in the background —
 *  never awaited here, so the very first speak() call still returns
 *  (and speaks, via Web Speech) immediately rather than blocking on a
 *  ~100MB fetch/decode. Every speak() call after Piper actually finishes
 *  loading picks it up on its own, just by isPiperReady() turning true —
 *  no separate "warm-up complete" signal to wire through. Never retried:
 *  one failed load is enough to fall back for good (see `piperBroken`). */
function kickOffPiperWarmup() {
    if (piperWarmupStarted)
        return;
    piperWarmupStarted = true;
    void ensurePiperLoaded().catch(() => {
        piperBroken = true;
    });
}
/** The single voice-guidance entry point — see module doc comment for
 *  which of the two engines actually ends up speaking. Stays a plain
 *  synchronous function on purpose: guided-session-view.ts calls it
 *  fire-and-forget on a fixed wall-clock beat schedule that must never
 *  wait on speech (real or synthetic) to finish. */
export function speak(text, options = {}) {
    try {
        kickOffPiperWarmup();
        if (!piperBroken && isPiperReady()) {
            void speakWithPiper(text).catch(() => {
                piperBroken = true; // one failure mid-session is enough — don't keep re-trying a broken engine beat by beat
                speakWithWebSpeech(text, options);
            });
            return;
        }
        speakWithWebSpeech(text, options);
    }
    catch {
        // best-effort only — see module doc comment
    }
}
export function stopSpeaking() {
    stopPiperSpeaking();
    try {
        chainToken++; // invalidate any in-flight clause chain before cancel() fires its own event
        getSpeechSynthesis()?.cancel();
    }
    catch {
        // best-effort only
    }
    stopKeepalive();
}
//# sourceMappingURL=voice-guide.js.map