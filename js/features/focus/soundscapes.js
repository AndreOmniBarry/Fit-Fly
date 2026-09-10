// Shared impulse-texture definitions — real per-droplet/per-pop
// transients (see texture-impulses.ts) rather than a fourth flavor of
// filtered hiss, reused by both Rain and Thunderstorm (a heavier gain,
// see the storm's own override below) and by Fireplace respectively.
const RAIN_DROPLETS = {
    id: 'rain-droplets',
    gain: 0.22,
    filters: [{ type: 'highpass', frequency: 3500, q: 0.6 }],
    impulse: { density: 30, minDurationSeconds: 0.004, maxDurationSeconds: 0.014, minGain: 0.15, maxGain: 0.5, decayRate: 45 },
};
const FIRE_POPS = {
    id: 'fire-pops',
    gain: 0.3,
    filters: [{ type: 'bandpass', frequency: 2200, q: 1.2 }],
    // Sparser and longer than a raindrop — a real crackle-pop is an
    // occasional snap, not a constant patter — with a rounder decay
    // (lower decayRate) so it reads as a "pop", not a "tick".
    impulse: { density: 2.2, minDurationSeconds: 0.02, maxDurationSeconds: 0.09, minGain: 0.35, maxGain: 1, decayRate: 18 },
};
export const SOUNDSCAPES = Object.freeze([
    {
        id: 'rain',
        name: 'Rain',
        description: 'Steady rainfall with a soft high-frequency shimmer — real individual droplet ticks, not just a filtered hiss.',
        icon: 'cloud-rain',
        layers: [
            { id: 'rain-body', color: 'pink', gain: 0.8, filters: [{ type: 'lowpass', frequency: 6500, q: 0.7 }, { type: 'highpass', frequency: 300, q: 0.7 }] },
            { id: 'rain-shimmer', color: 'white', gain: 0.15, filters: [{ type: 'highpass', frequency: 5000, q: 0.7 }] },
        ],
        impulseLayers: [RAIN_DROPLETS],
        motion: { enabled: false, radius: 1.5, plane: 'xz', periodSeconds: 60 },
        reverbMix: 0.18,
    },
    {
        id: 'thunderstorm',
        name: 'Thunderstorm',
        description: 'Heavy rain with a low, rolling rumble — real thunderclaps drift through at random, never on a fixed beat.',
        icon: 'cloud-lightning',
        layers: [
            { id: 'storm-rain', color: 'pink', gain: 0.85, filters: [{ type: 'lowpass', frequency: 7000, q: 0.7 }, { type: 'highpass', frequency: 250, q: 0.7 }] },
            { id: 'storm-shimmer', color: 'white', gain: 0.14, filters: [{ type: 'highpass', frequency: 5000, q: 0.7 }] },
            { id: 'storm-rumble', color: 'brown', gain: 0.35, filters: [{ type: 'lowpass', frequency: 140, q: 0.5 }] },
        ],
        impulseLayers: [{ ...RAIN_DROPLETS, id: 'storm-droplets', gain: 0.32 }],
        motion: { enabled: true, radius: 2.5, plane: 'xz', periodSeconds: 41 },
        reverbMix: 0.3,
        hasThunder: true,
    },
    {
        id: 'ocean',
        name: 'Ocean Waves',
        description: 'Waves rolling in and receding, slow and genuinely irregular — the swell and foam actually rise and fall, never a flat, unchanging wash.',
        icon: 'waves',
        layers: [
            { id: 'ocean-body', color: 'brown', gain: 0.75, filters: [{ type: 'lowpass', frequency: 900, q: 0.6 }] },
            { id: 'ocean-foam', color: 'white', gain: 0.13, filters: [{ type: 'bandpass', frequency: 3200, q: 0.9 }] },
        ],
        wander: [
            { layerId: 'ocean-body', param: 'gain', minValue: 0.45, maxValue: 0.95, minSegmentSeconds: 4, maxSegmentSeconds: 8 },
            { layerId: 'ocean-body', param: 'filterFrequency', minValue: 700, maxValue: 1150, minSegmentSeconds: 4, maxSegmentSeconds: 8 },
            { layerId: 'ocean-foam', param: 'gain', minValue: 0.03, maxValue: 0.24, minSegmentSeconds: 3, maxSegmentSeconds: 6 },
        ],
        motion: { enabled: true, radius: 2.2, plane: 'xz', periodSeconds: 11 },
        reverbMix: 0.12,
    },
    {
        id: 'river',
        name: 'River',
        description: 'A running stream over stones, bright and continuous, with a real, gentle flutter as the current shifts.',
        icon: 'droplet',
        layers: [
            { id: 'river-body', color: 'pink', gain: 0.75, filters: [{ type: 'bandpass', frequency: 1400, q: 0.5 }] },
            { id: 'river-babble', color: 'white', gain: 0.2, filters: [{ type: 'highpass', frequency: 2200, q: 1.1 }] },
        ],
        wander: [{ layerId: 'river-babble', param: 'gain', minValue: 0.12, maxValue: 0.28, minSegmentSeconds: 1.5, maxSegmentSeconds: 3.5 }],
        motion: { enabled: true, radius: 1.2, plane: 'xy', periodSeconds: 7 },
        reverbMix: 0.1,
    },
    {
        id: 'wind',
        name: 'Wind',
        description: 'A slow, drifting wind through open air — real gusts that genuinely swell and ease, not one held note.',
        icon: 'wind',
        layers: [
            { id: 'wind-body', color: 'pink', gain: 0.6, filters: [{ type: 'bandpass', frequency: 700, q: 0.4 }] },
        ],
        wander: [
            { layerId: 'wind-body', param: 'gain', minValue: 0.32, maxValue: 0.88, minSegmentSeconds: 5, maxSegmentSeconds: 10 },
            { layerId: 'wind-body', param: 'filterFrequency', minValue: 480, maxValue: 980, minSegmentSeconds: 6, maxSegmentSeconds: 11 },
        ],
        motion: { enabled: true, radius: 3, plane: 'xz', periodSeconds: 19, offsetAxis: 0.4 },
        reverbMix: 0.22,
    },
    {
        id: 'fireplace',
        name: 'Fireplace',
        description: 'A low crackle and steady warmth, close by — real, irregular snaps and pops, not a static hiss.',
        icon: 'flame',
        layers: [
            { id: 'fire-body', color: 'brown', gain: 0.85, filters: [{ type: 'lowpass', frequency: 1800, q: 0.5 }] },
            { id: 'fire-crackle', color: 'white', gain: 0.05, filters: [{ type: 'bandpass', frequency: 4500, q: 2.4 }] },
        ],
        impulseLayers: [FIRE_POPS],
        motion: { enabled: false, radius: 1, plane: 'xz', periodSeconds: 60 },
        reverbMix: 0.08,
    },
    {
        id: 'steady-noise',
        name: 'Steady Noise',
        description: 'Plain, even brown noise — no motion, nothing to notice.',
        icon: 'sliders',
        layers: [{ id: 'steady-body', color: 'brown', gain: 1, filters: [{ type: 'lowpass', frequency: 1200, q: 0.5 }] }],
        motion: { enabled: false, radius: 1, plane: 'xz', periodSeconds: 60 },
        reverbMix: 0.02,
    },
]);
export function getSoundscape(id) {
    return SOUNDSCAPES.find((s) => s.id === id);
}
//# sourceMappingURL=soundscapes.js.map