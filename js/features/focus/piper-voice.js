// Piper — a real VITS-based neural text-to-speech model, run entirely
// on-device via ONNX Runtime's WebAssembly backend. See voice-guide.ts,
// which owns the single speak()/stopSpeaking() surface every caller
// actually uses and stays the always-available fallback this sits
// beside.
//
// This app already tried an on-device neural voice once — Kokoro-82M,
// fetched from a CDN — and it was removed outright (see git history
// around commit f130aaa) after real-device reports of it going silent
// mid-session, traced to a hand-rolled AudioContext pipeline that could
// report a clip "started" before the context had actually confirmed
// 'running'. Two decisions here exist specifically to not repeat that:
//
//   1. Playback is a plain HTMLAudioElement, never AudioContext. Piper's
//      predict() resolves with one whole WAV Blob (piper-tts-web.js
//      chunks long text and concatenates the PCM itself before
//      resolving) — audio.play()'s own promise only resolves once
//      playback has genuinely begun, and 'ended'/'error' are plain,
//      unambiguous events with no scheduling and no readiness ambiguity
//      to get wrong twice.
//   2. Every failure mode — init, inference, playback — rejects a
//      promise instead of degrading silently on its own. Deciding what
//      "Piper isn't available right now" means (fall back to Web
//      Speech, and stop retrying for the rest of this session) is
//      voice-guide.ts's job, not this module's.
//
// The model and engine are vendored into this repo, not fetched from a
// CDN at runtime (see js/vendor/THIRD_PARTY_NOTICES.md for exactly what
// and why, and where each piece actually came from). wasmPaths below
// points the library at those vendored files directly — the one piece
// its public API doesn't expose an override for is the voice model's
// own fetch URL, hardcoded to https://huggingface.co/...; sw.js
// intercepts that exact request and answers it from the vendored copy
// instead, so the browser never actually reaches the network for it
// (see sw.js's own comment on this).
import { TtsSession } from '../../vendor/piper/piper-tts-web.js';
const VOICE_ID = 'en_US-ljspeech-medium';
const WASM_PATHS = {
    onnxWasm: './js/vendor/piper/onnx/',
    piperData: './js/vendor/piper/phonemize/piper_phonemize.data',
    piperWasm: './js/vendor/piper/phonemize/piper_phonemize.wasm',
};
let sessionPromise = null;
let readySession = null;
let loadFailed = false;
/** True only once a session has actually finished loading in this page's
 *  memory — never inferred from anything persisted, and never true while
 *  a load is merely in flight. voice-guide.ts uses this (not a saved
 *  preference) to decide, per call, whether Piper is really usable right
 *  now. */
export function isPiperReady() {
    return readySession != null;
}
export function didPiperLoadFail() {
    return loadFailed;
}
/** Loads the engine and model exactly once per page; every caller after
 *  the first shares this same in-flight/settled promise rather than
 *  re-initializing. Rejects — never throws synchronously, never resolves
 *  having quietly failed — so voice-guide.ts can decide what "Piper
 *  isn't available" means without this module making that call for it. */
export async function ensurePiperLoaded() {
    if (sessionPromise) {
        await sessionPromise;
        return;
    }
    loadFailed = false;
    sessionPromise = TtsSession.create({ voiceId: VOICE_ID, wasmPaths: WASM_PATHS })
        .then((session) => {
        readySession = session;
        return session;
    })
        .catch((error) => {
        loadFailed = true;
        sessionPromise = null; // a failed load isn't "loaded" — let a later call retry from scratch
        throw error;
    });
    await sessionPromise;
}
let currentAudio = null;
let speakToken = 0;
function playBlob(blob, token) {
    return new Promise((resolve, reject) => {
        if (token !== speakToken) {
            resolve(); // superseded before playback even started
            return;
        }
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        currentAudio = el;
        const cleanup = () => {
            URL.revokeObjectURL(url);
            if (currentAudio === el)
                currentAudio = null;
        };
        el.addEventListener('ended', () => {
            cleanup();
            resolve();
        }, { once: true });
        el.addEventListener('error', () => {
            cleanup();
            reject(new Error('Piper: audio playback failed.'));
        }, { once: true });
        // play()'s own promise only resolves once playback has genuinely
        // begun — the exact guarantee a hand-rolled AudioContext pipeline
        // couldn't make last time (see module doc comment).
        el.play().catch((error) => {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
}
/** Speaks one full line through Piper. Piper's own prosody already reads
 *  punctuation as real pauses and pitch movement — unlike the Web Speech
 *  path in voice-guide.ts, this doesn't need to split the line into
 *  clauses or hand-jitter rate/pitch to avoid sounding flat, so one
 *  predict() call per line is the whole job. Rejects if Piper isn't
 *  loaded, inference fails, or playback fails — voice-guide.ts is what
 *  turns that into a Web Speech fallback. */
export async function speakWithPiper(text) {
    if (!readySession)
        throw new Error('Piper is not loaded yet — call ensurePiperLoaded() first.');
    const session = readySession;
    const token = ++speakToken;
    const blob = await session.predict(text);
    if (token !== speakToken)
        return; // superseded by a newer speakWithPiper()/stopPiperSpeaking() call
    await playBlob(blob, token);
}
export function stopPiperSpeaking() {
    speakToken++;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}
//# sourceMappingURL=piper-voice.js.map