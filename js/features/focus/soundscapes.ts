// The Focus catalog — real content data, not placeholder copy. Each
// soundscape is one or more noise layers (color + a BiquadFilterNode
// chain that shapes it into something that actually sounds like rain,
// waves, wind, ...) plus an optional spatial motion profile. Framed for
// focus/rest generally, not just sleep — descriptions stay plain, no
// diagnostic or clinical language.
import type { OrbitPlane } from './spatial-motion.js';
import type { NoiseColor } from './noise-synthesis.js';
import type { IconName } from '../../lib/icons.js';

export interface FilterStage {
  type: BiquadFilterType;
  frequency: number;
  q?: number;
  gain?: number;
}

export interface NoiseLayer {
  id: string;
  color: NoiseColor;
  /** Relative mix level within the soundscape, 0-1. */
  gain: number;
  filters: FilterStage[];
}

export interface SoundscapeMotion {
  enabled: boolean;
  radius: number;
  plane: OrbitPlane;
  periodSeconds: number;
  offsetAxis?: number;
}

export interface Soundscape {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  layers: NoiseLayer[];
  motion: SoundscapeMotion;
  /** Wet/dry mix into the procedural reverb, 0-1. */
  reverbMix: number;
  /** Schedules real, synthesized thunderclap transients at random
   *  intervals while this soundscape plays — see thunder.ts. */
  hasThunder?: boolean;
}

export const SOUNDSCAPES: readonly Soundscape[] = Object.freeze([
  {
    id: 'rain',
    name: 'Rain',
    description: 'Steady rainfall with a soft high-frequency shimmer.',
    icon: 'cloud-rain',
    layers: [
      { id: 'rain-body', color: 'pink', gain: 0.8, filters: [{ type: 'lowpass', frequency: 6500, q: 0.7 }, { type: 'highpass', frequency: 300, q: 0.7 }] },
      { id: 'rain-shimmer', color: 'white', gain: 0.15, filters: [{ type: 'highpass', frequency: 5000, q: 0.7 }] },
    ],
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
    motion: { enabled: true, radius: 2.5, plane: 'xz', periodSeconds: 41 },
    reverbMix: 0.3,
    hasThunder: true,
  },
  {
    id: 'ocean',
    name: 'Ocean Waves',
    description: 'Waves rolling in and receding, slow and rhythmic.',
    icon: 'waves',
    layers: [
      { id: 'ocean-body', color: 'brown', gain: 0.9, filters: [{ type: 'lowpass', frequency: 900, q: 0.6 }] },
      { id: 'ocean-foam', color: 'white', gain: 0.12, filters: [{ type: 'bandpass', frequency: 3200, q: 0.9 }] },
    ],
    motion: { enabled: true, radius: 2.2, plane: 'xz', periodSeconds: 11 },
    reverbMix: 0.12,
  },
  {
    id: 'river',
    name: 'River',
    description: 'A running stream over stones, bright and continuous.',
    icon: 'droplet',
    layers: [
      { id: 'river-body', color: 'pink', gain: 0.75, filters: [{ type: 'bandpass', frequency: 1400, q: 0.5 }] },
      { id: 'river-babble', color: 'white', gain: 0.2, filters: [{ type: 'highpass', frequency: 2200, q: 1.1 }] },
    ],
    motion: { enabled: true, radius: 1.2, plane: 'xy', periodSeconds: 7 },
    reverbMix: 0.1,
  },
  {
    id: 'wind',
    name: 'Wind',
    description: 'A slow, drifting wind through open air.',
    icon: 'wind',
    layers: [
      { id: 'wind-body', color: 'pink', gain: 0.7, filters: [{ type: 'bandpass', frequency: 700, q: 0.4 }] },
    ],
    motion: { enabled: true, radius: 3, plane: 'xz', periodSeconds: 19, offsetAxis: 0.4 },
    reverbMix: 0.22,
  },
  {
    id: 'fireplace',
    name: 'Fireplace',
    description: 'A low crackle and steady warmth, close by.',
    icon: 'flame',
    layers: [
      { id: 'fire-body', color: 'brown', gain: 0.85, filters: [{ type: 'lowpass', frequency: 1800, q: 0.5 }] },
      { id: 'fire-crackle', color: 'white', gain: 0.08, filters: [{ type: 'bandpass', frequency: 4500, q: 2.4 }] },
    ],
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

export function getSoundscape(id: string): Soundscape | undefined {
  return SOUNDSCAPES.find((s) => s.id === id);
}
