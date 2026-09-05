// Kokoro-82M: a real 82-million-parameter neural text-to-speech model,
// run entirely on this device via ONNX Runtime's WebAssembly backend —
// genuine prosody, cadence, and breath-like pacing learned from real
// speech, not the formant/concatenative synthesis most browsers ship as
// their built-in "voices" (see voice-guide.ts, which stays the always-
// available fallback this sits beside). Nothing here is ever sent to a
// server: once loaded, generation happens on-device exactly like the
// Web Speech engine it complements.
//
// Why this isn't vendored like Dexie/Capacitor (see js/vendor/
// THIRD_PARTY_NOTICES.md): those libraries let the app stay fully
// offline from its very first load. Kokoro structurally can't — its
// weights (tens of megabytes even quantized) live on Hugging Face Hub
// with no vendorable npm form, so running it at all means a real,
// one-time network fetch no vendoring choice avoids. Given that,
// committing kokoro-js's own engine (its bundled ONNX Runtime
// WebAssembly binary alone is ~21MB) into this repository's permanent
// git history would cost real, irreversible size for zero offline
// benefit — the feature already can't work before its first real use
// either way. So the engine loads from jsDelivr instead (the CDN
// kokoro-js's own README recommends for no-bundler use), exactly once
// per browser: the same HTTP cache that will hold the model weights
// holds this too, so it isn't re-fetched every session. This is the one
// place in Fit Fly that talks to a third party at all — see sw.js's
// fetch handler and the README for the rest of the "vendored, not
// fetched" story this deliberately steps outside of. It's on by default
// (see voice-guide.ts's getVoiceEngine()), but never downloads on app
// boot — see ensureKokoroLoaded()'s callers for exactly when it does.
import { getPref, setPref } from '../../lib/storage.js';
const KOKORO_ENGINE_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// "q4" trades a real, audible slice of quality for a substantially
// smaller, faster download than kokoro-js's own "q8" default (see its
// README's dtype table) — deliberately, because this now downloads
// automatically the first time someone plays a guided session (see
// ensureKokoroLoaded()'s callers), not from an explicit "I'm choosing to
// wait for this" Settings action. A shorter download is also a shorter
// window for the one real failure mode this app can't avoid outright —
// the browser discarding an in-progress fetch if the tab backgrounds or
// reloads mid-download, which throws away that partial data and forces
// a full restart next time (there's no partial-resume here; the browser
// cache only ever holds a *complete* file).
const KOKORO_DTYPE = 'q4';
/** A curated subset of Kokoro's 28 shipped voices — every one here is
 *  the library's own top-graded ("A"/"A-"/"B-") pick, so "pick a voice"
 *  never surfaces one of the noticeably rougher lower-grade options the
 *  full list also contains. af_heart is Kokoro's own flagship voice
 *  (the only one it grades "A", the only one it marks with ❤️) and is
 *  the honest fit for this feature's own "therapeutic warmth" ask. */
export const KOKORO_VOICES = {
    af_heart: { label: 'Heart', description: 'Warm, calm — the flagship voice' },
    af_bella: { label: 'Bella', description: 'Warm, expressive' },
    am_fenrir: { label: 'Fenrir', description: 'Calm, grounded (male)' },
    bf_emma: { label: 'Emma', description: 'Warm, British' },
};
export const DEFAULT_KOKORO_VOICE = 'af_heart';
const KOKORO_VOICE_PREF_KEY = 'kokoro-voice';
/** Which of KOKORO_VOICES to actually speak with — a real, persisted
 *  choice (Settings), not hard-coded to the default: someone's honest
 *  read of "warm" isn't everyone's, and the whole point of a curated
 *  shortlist instead of one fixed voice is that they get to pick. Falls
 *  back to the default for anything unrecognized (an older saved value,
 *  a tampered localStorage entry) rather than throwing. */
export function getSavedKokoroVoice() {
    const saved = getPref(KOKORO_VOICE_PREF_KEY);
    return saved != null && saved in KOKORO_VOICES ? saved : DEFAULT_KOKORO_VOICE;
}
export function setSavedKokoroVoice(voice) {
    setPref(KOKORO_VOICE_PREF_KEY, voice);
}
/** Pure aggregation: folds one transformers.js progress_callback event
 *  into a running per-file loaded/total map and derives one overall
 *  percent from it. Exported and pure specifically so this — the one
 *  part of the download flow with real arithmetic in it — is unit-
 *  testable without a network or a 5-minute model download. */
export function aggregateProgress(byFile, event) {
    if (event.file && typeof event.loaded === 'number' && typeof event.total === 'number' && event.total > 0) {
        byFile.set(event.file, { loaded: event.loaded, total: event.total });
    }
    let loaded = 0;
    let total = 0;
    for (const entry of byFile.values()) {
        loaded += entry.loaded;
        total += entry.total;
    }
    const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
    return { percent, file: event.file ?? null };
}
/** The breath-length pause between two sentences Kokoro speaks back to
 *  back — real speech doesn't run one sentence into the next with zero
 *  gap, and Kokoro generates one clip per sentence (see speakWithKokoro),
 *  so this is what turns a sequence of clips into something that reads
 *  as one continuous, breathing delivery rather than a slideshow of
 *  utterances. Scales gently with speed: a slower, more deliberate
 *  delivery (meditation, sleep wind-down) earns a slightly longer real
 *  breath between sentences, not just slower speech within them. */
export function breathPauseMs(speed = 1) {
    const base = 260;
    return Math.round(base / Math.max(0.5, Math.min(1.5, speed)));
}
let modulePromise = null;
let ttsPromise = null;
let loadedInstance = null;
let loadFailed = false;
let lastProgress = null;
/** True only once a model instance has actually finished loading in this
 *  page's memory — never inferred from a saved preference, and never
 *  true while a load is merely in flight. A preference says what the
 *  person asked for; this says whether it's real right now, so a
 *  cleared cache or an offline reload always falls back to the Web
 *  Speech voice honestly instead of silently failing every speak(). */
export function isKokoroReady() {
    return loadedInstance != null;
}
/** True while a load — from any caller, anywhere in the app — is
 *  actually in flight. Lets a screen that didn't itself start the
 *  download (Settings, say, when a guided session already triggered it)
 *  reflect real progress passively, without starting a second one. */
export function isKokoroLoading() {
    return ttsPromise != null && loadedInstance == null && !loadFailed;
}
/** The most recent real progress event from any in-flight or completed
 *  load, regardless of which caller's onProgress (if any) requested it
 *  — see isKokoroLoading()'s own doc comment for why this needs to be
 *  observable independent of who actually started the download. */
export function getKokoroDownloadProgress() {
    return lastProgress;
}
export function didKokoroLoadFail() {
    return loadFailed;
}
/** Loads the engine (from jsDelivr, once per browser — see module doc
 *  comment) and the model (from Hugging Face Hub, cached by the browser
 *  afterward — see kokoro-js's own caching in its generated engine code).
 *  Safe to call repeatedly: every caller after the first shares the same
 *  in-flight/completed promise rather than re-downloading anything. */
export async function ensureKokoroLoaded(onProgress) {
    if (ttsPromise) {
        await ttsPromise;
        return;
    }
    loadFailed = false;
    lastProgress = null;
    const byFile = new Map();
    ttsPromise = (async () => {
        try {
            if (!modulePromise)
                modulePromise = import(KOKORO_ENGINE_URL);
            const { KokoroTTS } = await modulePromise;
            const instance = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
                dtype: KOKORO_DTYPE,
                device: 'wasm',
                progress_callback: (e) => {
                    lastProgress = aggregateProgress(byFile, e);
                    onProgress?.(lastProgress);
                },
            });
            loadedInstance = instance;
            return instance;
        }
        catch (error) {
            loadFailed = true;
            ttsPromise = null; // a failed load isn't "loaded" — let a future call retry from scratch
            throw error;
        }
    })();
    await ttsPromise;
}
/** Forgets this page's in-memory model (a fresh reload will re-fetch it
 *  from the browser's own caches, not the network, unless clearCaches()
 *  below has also run) and, when asked, deletes the two Cache Storage
 *  buckets kokoro-js's own engine writes to — the actual multi-megabyte
 *  browser-storage cost Settings' "remove downloaded voice" button
 *  exists to give back. Best-effort: a storage API that throws (private
 *  browsing, disabled storage) shouldn't stop the in-memory reset. */
export async function forgetKokoroModel(clearCaches) {
    modulePromise = null;
    ttsPromise = null;
    loadedInstance = null;
    loadFailed = false;
    lastProgress = null;
    if (!clearCaches || typeof caches === 'undefined')
        return;
    try {
        await Promise.all([caches.delete('transformers-cache'), caches.delete('kokoro-voices')]);
    }
    catch {
        // best-effort only
    }
}
// Playback deliberately reuses the exact pattern audio-cue.js's
// primeAudio()/playCompletionBeep() and Focus's own audio-engine.ts
// already rely on, rather than a plain HTMLAudioElement: a shared
// AudioContext, resumed once inside a real user-gesture handler, stays
//'running' for any audio scheduled on it *later* — even from deep
// inside the multi-second, multi-await chain a streamed sentence
// actually takes to generate — without needing a fresh gesture for
// every single clip. An HTMLAudioElement's own .play() doesn't get that
// same leniency on stricter browsers (notably iOS Safari): calling it
// after that many awaits reads as "not really" a response to the
// original tap, so the browser silently refuses to play it — and worse,
// that refusal was previously being swallowed as if playback had
// finished normally (see the git history of this function for the bug
// that caused: a guided session or Settings' Preview button visibly
// "playing" — captions advancing, pacer animating — with no sound at
// all, and no error, no fallback, nothing to notice anything was wrong).
let sharedAudioCtx = null;
/** Call this from inside a real user-gesture handler — see the module
 *  comment on the shared AudioContext above for why that's what actually
 *  makes later, async-delayed playback audible. speak() (voice-
 *  guide.ts) already does this on every call, so callers of this module
 *  don't need to remember to. Safe and cheap to call repeatedly. */
export function primeKokoroAudio() {
    try {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        if (!AudioContextClass)
            return;
        if (!sharedAudioCtx)
            sharedAudioCtx = new AudioContextClass();
        if (sharedAudioCtx.state === 'suspended')
            void sharedAudioCtx.resume().catch(() => { });
    }
    catch {
        // best-effort only
    }
}
let currentSource = null;
let speakToken = 0;
/** Speaks text through Kokoro, one real sentence at a time (kokoro-js's
 *  own sentence splitter — see its stream() — handles abbreviations,
 *  decimals, and quotes correctly, which is why this doesn't re-invent
 *  clause-splitting the way voice-guide.ts's Web Speech path has to): each
 *  sentence keeps Kokoro's own real, model-learned prosody intact end to
 *  end, and a breathPauseMs() gap between sentences supplies the one
 *  thing generating them separately loses — a real pause where a person
 *  would actually breathe. Throws if the model isn't loaded yet — callers
 *  (voice-guide.ts) are expected to have awaited ensureKokoroLoaded()
 *  first and to fall back to Web Speech otherwise. */
export async function speakWithKokoro(text, { voice = DEFAULT_KOKORO_VOICE, speed = 1 } = {}) {
    if (!loadedInstance)
        throw new Error('Kokoro is not loaded yet — call ensureKokoroLoaded() first.');
    const tts = loadedInstance;
    const token = ++speakToken;
    const pauseMs = breathPauseMs(speed);
    for await (const { audio } of tts.stream(text, { voice, speed })) {
        if (token !== speakToken)
            return; // superseded by a newer speakWithKokoro()/stopKokoroSpeaking() call
        await playBlob(audio.toBlob(), token);
        if (token !== speakToken)
            return;
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
}
async function playBlob(blob, token) {
    primeKokoroAudio(); // best-effort: re-resume in case the context lapsed since the last prime
    const ctx = sharedAudioCtx;
    if (!ctx)
        return; // Web Audio unsupported — silent, same best-effort contract as every other Web API wrapper here
    if (token !== speakToken)
        return;
    let audioBuffer;
    try {
        audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    }
    catch {
        return; // a genuinely corrupt clip is rare and not worth surfacing mid-session — just skip it
    }
    if (token !== speakToken)
        return;
    await new Promise((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        currentSource = source;
        source.onended = () => {
            if (currentSource === source)
                currentSource = null;
            resolve();
        };
        source.start();
    });
}
export function stopKokoroSpeaking() {
    speakToken++;
    if (currentSource) {
        try {
            currentSource.stop();
        }
        catch {
            // already stopped/ended — fine
        }
        currentSource = null;
    }
}
//# sourceMappingURL=kokoro-voice.js.map