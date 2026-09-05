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
// fetched" story this deliberately steps outside of. That's why it's
// strictly opt-in (see settings-view.ts) rather than loaded on app boot.
import { getPref, setPref } from '../../lib/storage.js';
const KOKORO_ENGINE_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// "q8" is kokoro-js's own documented default for the WASM device (see its
// README) — the practical middle ground between "fp32"'s size and
// "q4"'s quality loss, chosen deliberately over squeezing out the last
// few megabytes at the cost of the exact warmth this feature exists for.
const KOKORO_DTYPE = 'q8';
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
/** True only once a model instance has actually finished loading in this
 *  page's memory — never inferred from a saved preference, and never
 *  true while a load is merely in flight. A preference says what the
 *  person asked for; this says whether it's real right now, so a
 *  cleared cache or an offline reload always falls back to the Web
 *  Speech voice honestly instead of silently failing every speak(). */
export function isKokoroReady() {
    return loadedInstance != null;
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
    const byFile = new Map();
    ttsPromise = (async () => {
        try {
            if (!modulePromise)
                modulePromise = import(KOKORO_ENGINE_URL);
            const { KokoroTTS } = await modulePromise;
            const instance = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
                dtype: KOKORO_DTYPE,
                device: 'wasm',
                progress_callback: onProgress ? (e) => onProgress(aggregateProgress(byFile, e)) : undefined,
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
    if (!clearCaches || typeof caches === 'undefined')
        return;
    try {
        await Promise.all([caches.delete('transformers-cache'), caches.delete('kokoro-voices')]);
    }
    catch {
        // best-effort only
    }
}
let currentAudio = null;
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
function playBlob(blob, token) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        currentAudio = el;
        const cleanup = () => {
            URL.revokeObjectURL(url);
            if (currentAudio === el)
                currentAudio = null;
            resolve();
        };
        el.addEventListener('ended', cleanup, { once: true });
        el.addEventListener('error', cleanup, { once: true });
        if (token !== speakToken) {
            cleanup();
            return;
        }
        void el.play().catch(cleanup);
    });
}
export function stopKokoroSpeaking() {
    speakToken++;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}
//# sourceMappingURL=kokoro-voice.js.map