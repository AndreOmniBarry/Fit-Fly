// Free, on-device voice guidance for guided sessions — the browser's
// built-in Web Speech Synthesis API. No account, no API key, no per-call
// cost, no external service to register with: every major browser ships
// real text-to-speech voices with the OS, spoken entirely locally. Feature-
// detected and defensive throughout, the same contract as every other Web
// API wrapper in this app (audio-cue.js, camera-ppg.js, ...): a missing or
// blocked implementation degrades to silence, never a thrown error — the
// on-screen caption (see guided-session-view.ts) carries the session
// either way, so voice guidance is a real enhancement, not a dependency.
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
function pickVoice(synth) {
    if (preferredVoice)
        return preferredVoice;
    if (cachedVoices.length === 0)
        ensureVoicesLoading(synth);
    // A local (on-device, not network-backed) English voice reads as
    // noticeably higher quality and lower latency than a remote one where
    // both exist — this is a real quality heuristic, not an arbitrary pick.
    preferredVoice =
        cachedVoices.find((v) => v.localService && v.lang.startsWith('en')) ??
            cachedVoices.find((v) => v.lang.startsWith('en')) ??
            cachedVoices[0] ??
            null;
    return preferredVoice;
}
/** Speaks one line, cancelling whatever was still being said — a guided
 *  session's beats are meant to replace each other, never overlap. */
export function speak(text, { rate = 0.92, pitch = 1 } = {}) {
    try {
        const synth = getSpeechSynthesis();
        if (!synth)
            return;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate; // a touch slower than default — deliberate, not rushed
        utterance.pitch = pitch;
        const voice = pickVoice(synth);
        if (voice)
            utterance.voice = voice;
        synth.speak(utterance);
    }
    catch {
        // best-effort only — see module doc comment
    }
}
export function stopSpeaking() {
    try {
        getSpeechSynthesis()?.cancel();
    }
    catch {
        // best-effort only
    }
}
//# sourceMappingURL=voice-guide.js.map