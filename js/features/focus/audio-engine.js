// The real, stateful Focus engine — Web Audio only, no audio files
// (nothing to fetch in an offline-first, no-server PWA). Every soundscape
// is layered procedural noise (see noise-synthesis.ts) run through a real
// filter chain, a shared PannerNode in HRTF mode animated along a 3D orbit
// (spatial-motion.ts) so it genuinely moves around the listener rather
// than sitting in fixed stereo, and a procedural reverb (impulse-
// response.ts) for depth. Feature-detected and defensive throughout, the
// same spirit as audio-cue.js's primeAudio()/playCompletionBeep(): a
// missing or blocked Web Audio API degrades to "nothing plays", never a
// thrown error into the caller.
//
// AudioContext is created lazily, inside start() — which callers must
// invoke from a real user-gesture handler (a click), the same constraint
// documented on primeAudio() — so autoplay policies don't block it.
import { createCountdown } from '../../lib/timer.js';
import { crossfadeLoopBuffer, generateBrownNoise, generatePinkNoise, generateWhiteNoise } from './noise-synthesis.js';
import { createPrng } from './prng.js';
import { positionAtTime } from './spatial-motion.js';
import { generateImpulseResponse } from './impulse-response.js';
import { generateThunderclapBurst, randomThunderclapDuration } from './thunder.js';
import { getSoundscape } from './soundscapes.js';
const SAMPLE_RATE = 48000; // the "high rez" this feature asks for — browsers may clamp to hardware output rate, which is fine; this is a request, not a guarantee
const LAYER_BUFFER_SECONDS = 24; // long enough that the loop point is never obviously audible
const LOOP_CROSSFADE_SECONDS = 1.5;
const REVERB_SECONDS = 2.2;
const REVERB_DECAY = 2.6;
const FADE_SECONDS = 1.4; // start/stop ramp — no click, no jarring onset for a calming sound
const POSITION_UPDATE_INTERVAL_MS = 200; // how often the panner's target position is re-issued; the ramp between updates is what makes the motion smooth, not this cadence
const STATE_POLL_INTERVAL_MS = 1000;
const MIN_THUNDER_DELAY_S = 9;
const MAX_THUNDER_DELAY_S = 32; // real storms don't clap on a beat — a wide, randomized gap is what keeps it from feeling looped
function getAudioContextClass() {
    return window.AudioContext ?? window.webkitAudioContext ?? null;
}
function generateNoiseBuffer(color, length, seed) {
    const rng = createPrng(seed);
    const raw = color === 'white' ? generateWhiteNoise(length, rng) : color === 'pink' ? generatePinkNoise(length, rng) : generateBrownNoise(length, rng);
    return crossfadeLoopBuffer(raw, Math.floor(LOOP_CROSSFADE_SECONDS * SAMPLE_RATE));
}
function toAudioBuffer(ctx, data, sampleRate) {
    const buffer = ctx.createBuffer(1, data.length, sampleRate);
    // lib.dom's copyToChannel signature wants Float32Array<ArrayBuffer>
    // specifically; every Float32Array this module produces is backed by a
    // plain ArrayBuffer at runtime (never a SharedArrayBuffer), so this is
    // a lib-typing quirk, not an unsafe cast.
    buffer.copyToChannel(data, 0);
    return buffer;
}
export class FocusAudioEngine {
    ctx = null;
    masterGain = null;
    graph = null;
    soundscapeId = null;
    volume = 0.7;
    timerMinutes = null;
    countdown = null;
    positionHandle = null;
    pollHandle = null;
    listeners = new Set();
    lastStartBlocked = false;
    isSupported() {
        return getAudioContextClass() != null;
    }
    getState() {
        return {
            supported: this.isSupported(),
            playing: this.graph != null,
            soundscapeId: this.soundscapeId,
            volume: this.volume,
            timerMinutes: this.timerMinutes,
            remainingMs: this.countdown ? this.countdown.getRemainingMs() : null,
            blocked: this.lastStartBlocked,
        };
    }
    onStateChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notify() {
        const state = this.getState();
        for (const listener of this.listeners)
            listener(state);
    }
    setVolume(volume) {
        this.volume = Math.min(1, Math.max(0, volume));
        if (this.masterGain && this.ctx) {
            const gain = this.masterGain.gain;
            const now = this.ctx.currentTime;
            // Cancel first — otherwise this ramp only overrides the automation
            // curve up to its own end time, and a longer-running start()/stop()
            // fade still scheduled past that point would resume afterward.
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
            gain.linearRampToValueAtTime(this.volume, now + 0.15);
        }
        this.notify();
    }
    /** `null` means "no timer — plays until stopped". */
    setTimer(minutes) {
        this.timerMinutes = minutes;
        if (this.graph)
            this.restartCountdown();
        this.notify();
    }
    restartCountdown() {
        this.stopCountdownPolling();
        if (this.timerMinutes == null) {
            this.countdown = null;
            return;
        }
        this.countdown = createCountdown(this.timerMinutes * 60_000);
        this.countdown.start();
        this.pollHandle = setInterval(() => {
            if (this.countdown?.isFinished()) {
                this.stop();
                return;
            }
            this.notify();
        }, STATE_POLL_INTERVAL_MS);
    }
    stopCountdownPolling() {
        if (this.pollHandle != null)
            clearInterval(this.pollHandle);
        this.pollHandle = null;
    }
    /** Must be called from inside a real user-gesture handler (a click) —
     *  see the module doc comment. Resolves once playback has actually
     *  started; resolves silently (does nothing) if Web Audio isn't
     *  available, the same "best-effort, never throws" contract as
     *  audio-cue.js. */
    async start(soundscapeId) {
        const soundscape = getSoundscape(soundscapeId);
        if (!soundscape)
            return;
        try {
            const AudioContextClass = getAudioContextClass();
            if (!AudioContextClass)
                return;
            if (!this.ctx) {
                this.ctx = new AudioContextClass({ sampleRate: SAMPLE_RATE });
            }
            if (this.ctx.state === 'suspended')
                await this.ctx.resume().catch(() => { });
            // A real, detectable failure: the browser withheld playback despite
            // this running inside a genuine click handler. Bail out honestly —
            // building the graph anyway would report "Playing" for a context
            // producing no sound at all, worse than admitting it didn't start.
            if (this.ctx.state !== 'running') {
                this.lastStartBlocked = true;
                this.notify();
                return;
            }
            this.lastStartBlocked = false;
            this.teardownGraph();
            const ctx = this.ctx;
            const masterGain = this.masterGain ?? ctx.createGain();
            if (!this.masterGain) {
                masterGain.gain.value = 0;
                masterGain.connect(ctx.destination);
                this.masterGain = masterGain;
            }
            const convolver = ctx.createConvolver();
            convolver.buffer = toAudioBuffer(ctx, generateImpulseResponse(REVERB_SECONDS, ctx.sampleRate, REVERB_DECAY), ctx.sampleRate);
            const panner = ctx.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            const dryGain = ctx.createGain();
            dryGain.gain.value = 1;
            const wetGain = ctx.createGain();
            wetGain.gain.value = soundscape.reverbMix;
            panner.connect(dryGain).connect(masterGain);
            panner.connect(wetGain).connect(convolver).connect(masterGain);
            const layers = soundscape.layers.map((layer, i) => {
                const length = Math.floor(LAYER_BUFFER_SECONDS * ctx.sampleRate);
                const data = generateNoiseBuffer(layer.color, length, hashSeed(soundscapeId, layer.id, i));
                const audioBuffer = toAudioBuffer(ctx, data, ctx.sampleRate);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.loop = true;
                const filters = layer.filters.map((stage) => {
                    const filter = ctx.createBiquadFilter();
                    filter.type = stage.type;
                    filter.frequency.value = stage.frequency;
                    if (stage.q != null)
                        filter.Q.value = stage.q;
                    if (stage.gain != null)
                        filter.gain.value = stage.gain;
                    return filter;
                });
                const gain = ctx.createGain();
                gain.gain.value = layer.gain;
                let node = source;
                for (const filter of filters) {
                    node.connect(filter);
                    node = filter;
                }
                node.connect(gain).connect(panner);
                source.start();
                return { source, filters, gain };
            });
            this.graph = {
                layers,
                panner,
                dryGain,
                wetGain,
                convolver,
                motionStartTime: ctx.currentTime,
                motionProfile: soundscape.motion,
                thunderTimeoutId: null,
            };
            this.soundscapeId = soundscapeId;
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + FADE_SECONDS);
            this.startPositionAnimation();
            this.restartCountdown();
            if (soundscape.hasThunder)
                this.scheduleNextThunderclap(this.graph, ctx);
            this.notify();
        }
        catch {
            // best-effort only — a blocked/failing Web Audio API leaves nothing
            // playing rather than throwing into the caller
            this.teardownGraph();
        }
    }
    startPositionAnimation() {
        this.stopPositionAnimation();
        if (!this.ctx || !this.graph)
            return;
        const { panner, motionProfile, motionStartTime } = this.graph;
        const ctx = this.ctx;
        const tick = () => {
            if (!this.graph)
                return;
            const elapsed = ctx.currentTime - motionStartTime;
            const pos = positionAtTime(motionProfile, elapsed);
            const rampTo = ctx.currentTime + POSITION_UPDATE_INTERVAL_MS / 1000;
            panner.positionX.linearRampToValueAtTime(pos.x, rampTo);
            panner.positionY.linearRampToValueAtTime(pos.y, rampTo);
            panner.positionZ.linearRampToValueAtTime(pos.z, rampTo);
        };
        tick();
        this.positionHandle = setInterval(tick, POSITION_UPDATE_INTERVAL_MS);
    }
    stopPositionAnimation() {
        if (this.positionHandle != null)
            clearInterval(this.positionHandle);
        this.positionHandle = null;
    }
    /** Schedules the next thunderclap at a random delay, and reschedules
     *  itself after each one fires — an open-ended cadence for as long as
     *  this graph stays the active one. */
    scheduleNextThunderclap(graph, ctx) {
        const delayMs = (MIN_THUNDER_DELAY_S + Math.random() * (MAX_THUNDER_DELAY_S - MIN_THUNDER_DELAY_S)) * 1000;
        graph.thunderTimeoutId = setTimeout(() => {
            if (this.graph !== graph)
                return; // stopped or switched to a different soundscape in the meantime
            this.playThunderclap(graph, ctx);
            this.scheduleNextThunderclap(graph, ctx);
        }, delayMs);
    }
    /** One real, synthesized thunderclap (see thunder.ts) — a fresh burst
     *  every time, positioned in a random direction on its own one-shot
     *  PannerNode (independent of the continuous layers' motion, since real
     *  thunder doesn't travel with the rain), fed into the same dry/wet
     *  reverb send as everything else so it shares the room. */
    playThunderclap(graph, ctx) {
        const duration = randomThunderclapDuration();
        const data = generateThunderclapBurst(ctx.sampleRate, duration);
        const buffer = toAudioBuffer(ctx, data, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.value = 900 + Math.random() * 400;
        const clapGain = ctx.createGain();
        clapGain.gain.value = 0.55 + Math.random() * 0.25; // not every clap is equally loud, like a real storm
        const clapPanner = ctx.createPanner();
        clapPanner.panningModel = 'HRTF';
        clapPanner.distanceModel = 'inverse';
        clapPanner.refDistance = 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 4; // farther out than the continuous ambience — thunder reads as "out there", not in-ear
        clapPanner.positionX.value = Math.cos(angle) * radius;
        clapPanner.positionZ.value = Math.sin(angle) * radius;
        source.connect(rumbleFilter).connect(clapGain).connect(clapPanner);
        clapPanner.connect(graph.dryGain);
        clapPanner.connect(graph.wetGain);
        source.start();
        source.onended = () => {
            source.disconnect();
            rumbleFilter.disconnect();
            clapGain.disconnect();
            clapPanner.disconnect();
        };
    }
    /** Disposes exactly the audio nodes belonging to one captured graph.
     *  Deliberately touches nothing on `this` — see stop()'s deferred call
     *  below: by the time this runs, `this.graph` may already be a *newer*
     *  graph from a fresh start() called in the interim, and this must
     *  never reach in and clobber that. */
    disposeGraphNodes(graph) {
        if (graph.thunderTimeoutId != null)
            clearTimeout(graph.thunderTimeoutId);
        for (const layer of graph.layers) {
            try {
                layer.source.stop();
            }
            catch {
                // already stopped — fine
            }
            layer.source.disconnect();
            for (const filter of layer.filters)
                filter.disconnect();
            layer.gain.disconnect();
        }
        graph.panner.disconnect();
        graph.dryGain.disconnect();
        graph.wetGain.disconnect();
        graph.convolver.disconnect();
    }
    /** Tears down *this engine's current* graph and resets every
     *  engine-wide field that goes with it (soundscapeId, position
     *  animation, countdown). Only ever call this for the graph actually
     *  in `this.graph` right now — see disposeGraphNodes for the
     *  interleaved-stop-then-start-safe variant. */
    teardownGraph() {
        if (this.graph)
            this.disposeGraphNodes(this.graph);
        this.graph = null;
        this.soundscapeId = null;
        this.stopPositionAnimation();
        this.stopCountdownPolling();
        this.countdown = null;
    }
    stop() {
        this.lastStartBlocked = false; // a fresh stop clears any stale "didn't start" state too
        if (!this.ctx || !this.masterGain || !this.graph) {
            this.teardownGraph();
            this.notify();
            return;
        }
        const ctx = this.ctx;
        const masterGain = this.masterGain;
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_SECONDS);
        const graphToDispose = this.graph;
        this.graph = null; // playing:false immediately — the fade-out is cosmetic, not a state lie
        this.soundscapeId = null;
        this.stopPositionAnimation();
        this.stopCountdownPolling();
        this.countdown = null;
        this.notify();
        // Deferred, and deliberately only disposes graphToDispose's own
        // nodes — if start() is called again before this fires, this.graph
        // is by then a different, newer graph that must survive untouched.
        setTimeout(() => {
            this.disposeGraphNodes(graphToDispose);
        }, FADE_SECONDS * 1000 + 100);
    }
}
/** A small, deterministic string hash — different (soundscape, layer)
 *  pairs get different noise, without needing real entropy for something
 *  that only has to *sound* varied, not be cryptographically random. */
function hashSeed(...parts) {
    let hash = 0;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}
export function createFocusAudioEngine() {
    return new FocusAudioEngine();
}
// One shared engine instance for the whole app — Focus and Sleep's
// Wind Down screen both control and observe the exact same playback
// state, rather than each owning a disconnected AudioContext.
let sharedEngine = null;
export function getFocusAudioEngine() {
    if (!sharedEngine)
        sharedEngine = createFocusAudioEngine();
    return sharedEngine;
}
//# sourceMappingURL=audio-engine.js.map