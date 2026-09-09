// Free, on-device voice guidance for guided sessions — the browser's
// built-in Web Speech Synthesis API. No account, no API key, no per-call
// cost, no external service to register with: every major browser ships
// real text-to-speech voices with the OS, spoken entirely locally. Feature-
// detected and defensive throughout, the same contract as every other Web
// API wrapper in this app (audio-cue.js, camera-ppg.js, ...): a missing or
// blocked implementation degrades to silence, never a thrown error — the
// on-screen caption (see guided-session-view.ts) carries the session
// either way, so voice guidance is a real enhancement, not a dependency.
//
// A second engine sits behind the same speak()/stopSpeaking() surface —
// Kokoro-82M, a real neural TTS model run on-device (see kokoro-voice.ts
// for what that actually costs). The built-in voice is the *default*
// engine, not Kokoro — the reverse of this project's earlier direction,
// changed deliberately after repeated real-device reports of Kokoro
// staying silent even with primeKokoroAudio()/primeSystemVoice() and a
// bounded fallback timeout all in place, none of it verifiable from this
// project's own sandbox (no real audio output to test against). A voice
// guide that sometimes doesn't speak is a worse default than a voice
// guide that's always audible, even at lower synthesis quality — so
// Settings makes Kokoro an explicit opt-in instead: choosing it there is
// an informed choice for whoever's device handles it well, not the whole
// app's front-line bet. Persisted via getPref/setPref; everything below
// still ends up calling this module's own speak()/stopSpeaking(), so
// guided-session-view.ts and every other caller never needs to know
// which engine actually spoke.
import { getPref } from '../../lib/storage.js';
import { didKokoroLoadFail, ensureKokoroLoaded, getSavedKokoroVoice, isKokoroReady, primeKokoroAudio, speakWithKokoro, stopKokoroSpeaking, } from './kokoro-voice.js';
// How long a Kokoro attempt gets to produce its first real sound before
// speak() gives up on it and speaks the line the reliable way instead.
// Generous relative to a typical short guided-session beat, but bounded:
// the very first sentence generated right after a fresh model load pays
// a real, one-time WASM warm-up cost on top of normal per-sentence
// inference, and on a phone that can genuinely take longer than the beat
// itself lasts — see kokoro-voice.ts's speakWithKokoro() doc comment for
// what silently waiting on it instead would actually do (go silent for
// the rest of the session, not just the one slow attempt).
const KOKORO_FIRST_AUDIO_TIMEOUT_MS = 2500;
export const VOICE_ENGINE_PREF_KEY = 'voice-engine';
/** The built-in voice is the default the moment no one has said
 *  otherwise — see the module doc comment for why. The pref only ever
 *  needs to exist at all once someone actively opts *in* to Kokoro, in
 *  Settings; someone who already saved 'kokoro' before this default
 *  flipped keeps that real, explicit choice. */
export function getVoiceEngine() {
    return getPref(VOICE_ENGINE_PREF_KEY) === 'kokoro' ? 'kokoro' : 'system';
}
function getSpeechSynthesis() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}
// iOS Safari applies the same "only inside a real, recent user gesture"
// restriction to speechSynthesis.speak() that kokoro-voice.ts's own
// module comment documents for AudioContext/HTMLAudioElement — except
// WebKit's version of it is stricter still: a call from a setTimeout or
// a promise-chain callback, even one that started inside a genuine tap,
// silently no-ops instead of throwing, *unless* speechSynthesis has
// already spoken successfully from directly inside a real gesture at
// least once this page's lifetime. Kokoro being the default engine is
// exactly what breaks that: its own playback goes through AudioContext,
// so speechSynthesis.speak() might never be called at all until the
// bounded fallback timeout below fires — asynchronously, well outside
// the tap that started the session, i.e. exactly the pattern iOS drops.
// Without this, KOKORO_FIRST_AUDIO_TIMEOUT_MS's fallback would silently
// fail on iOS the same way the Kokoro attempt it's falling back from
// did — a second silent failure standing in for the first one, not a
// working fix. primeKokoroAudio() already solves this same problem for
// AudioContext; this is that same fix for the other audio API.
let systemVoicePrimed = false;
function primeSystemVoice() {
    if (systemVoicePrimed)
        return;
    try {
        const synth = getSpeechSynthesis();
        if (!synth)
            return;
        systemVoicePrimed = true;
        // volume:0 — this genuinely "speaks" (satisfying whatever real-
        // gesture bookkeeping iOS does), but produces no audible sound of
        // its own to notice or for it to race against anything real.
        const utterance = new SpeechSynthesisUtterance(' ');
        utterance.volume = 0;
        synth.speak(utterance);
    }
    catch {
        // best-effort only — see module doc comment
    }
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
function speakWithSystemVoice(text, { rate = 0.92, pitch = 1 } = {}) {
    try {
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
    }
    catch {
        // best-effort only — see module doc comment
    }
}
/** Speaks one line, on whichever engine is active (see getVoiceEngine()
 *  — Kokoro unless Settings has explicitly turned it off). Kokoro needs
 *  its model already loaded to speak synchronously the way this API's
 *  callers (guided-session-view.ts) expect — a guided-breathing beat
 *  can't wait seconds mid-cue for a cold model load — so a call that
 *  lands before it's finished loading honestly falls back to the system
 *  voice for *this* line rather than staying silent, while kicking off
 *  the load in the background: the very first speak() of someone's very
 *  first guided session or meditation is what actually triggers Kokoro's
 *  one-time download (see kokoro-voice.ts), with no Settings visit
 *  required — that first session narrates on the built-in voice while it
 *  downloads, and every session after it gets the real thing. A load
 *  that has genuinely failed (offline, storage denied) isn't retried on
 *  every single line — see didKokoroLoadFail().
 *
 *  primeKokoroAudio() runs on every call, gesture or not: real speech is
 *  reached through this function from both a direct tap (Settings'
 *  Preview button) and a countdown timer's callback (each later beat in
 *  a running session) — see that function's own doc comment for why a
 *  shared, already-resumed AudioContext is what makes both paths
 *  actually produce sound instead of a browser silently discarding
 *  playback that arrives too many awaits away from the original tap. */
export function speak(text, { rate = 0.92, pitch = 1, kokoroVoice } = {}) {
    if (getVoiceEngine() === 'kokoro') {
        primeKokoroAudio();
        // See primeSystemVoice()'s own doc comment: this is what makes the
        // *fallback* below actually audible on iOS, not just the Kokoro
        // attempt it's a fallback from — both need priming from inside this
        // same real gesture, not just one of them.
        primeSystemVoice();
        if (isKokoroReady()) {
            let audioStarted = false;
            void speakWithKokoro(text, {
                voice: kokoroVoice ?? getSavedKokoroVoice(),
                speed: rate,
                onAudioStart: () => {
                    audioStarted = true;
                },
            }).catch(() => {
                // A load that was ready a moment ago can still fail mid-generation
                // (e.g. the tab reclaimed memory) — fall back rather than go silent.
                // Only if nothing from this attempt was ever actually heard: the
                // timeout below already owns that decision once real audio has
                // started, so this and the timeout never both speak the same line.
                if (!audioStarted)
                    speakWithSystemVoice(text, { rate, pitch });
            });
            // See KOKORO_FIRST_AUDIO_TIMEOUT_MS's own comment: give this a real,
            // bounded window to actually start producing sound before falling
            // back, rather than risking it arrive only once a later beat's own
            // speak() call has already superseded it (kokoro-voice.ts's
            // speakToken) — audibly late beats a permanently silent session.
            setTimeout(() => {
                if (!audioStarted) {
                    stopKokoroSpeaking();
                    speakWithSystemVoice(text, { rate, pitch });
                }
            }, KOKORO_FIRST_AUDIO_TIMEOUT_MS);
            return;
        }
        // Fire-and-forget on purpose (this line already fell back to the
        // system voice above/below) — but still caught: didKokoroLoadFail()
        // is how a *future* speak() call learns this failed, an uncaught
        // rejection here would just be a spurious console error on top.
        if (!didKokoroLoadFail())
            ensureKokoroLoaded().catch(() => { });
    }
    speakWithSystemVoice(text, { rate, pitch });
}
export function stopSpeaking() {
    try {
        chainToken++; // invalidate any in-flight clause chain before cancel() fires its own event
        getSpeechSynthesis()?.cancel();
    }
    catch {
        // best-effort only
    }
    stopKokoroSpeaking();
}
//# sourceMappingURL=voice-guide.js.map