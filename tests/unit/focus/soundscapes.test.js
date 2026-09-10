import { describe, expect, it } from 'vitest';
import { getSoundscape, SOUNDSCAPES } from '../../../js/features/focus/soundscapes.js';

describe('SOUNDSCAPES catalog', () => {
  it('has real, distinct content — not one generic entry', () => {
    expect(SOUNDSCAPES.length).toBeGreaterThanOrEqual(5);
  });

  it('every id is unique', () => {
    const ids = SOUNDSCAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has at least one layer and a real name/description/icon', () => {
    for (const s of SOUNDSCAPES) {
      expect(s.layers.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });

  it('descriptions avoid diagnostic/clinical language', () => {
    const bannedWords = /anxiety|overthink|stress|mental health|therapy|clinical/i;
    for (const s of SOUNDSCAPES) {
      expect(s.description).not.toMatch(bannedWords);
    }
  });

  it('every layer gain is a valid 0-1 mix level', () => {
    for (const s of SOUNDSCAPES) {
      for (const layer of s.layers) {
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.gain).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every filter stage has a positive frequency', () => {
    for (const s of SOUNDSCAPES) {
      for (const layer of s.layers) {
        for (const filter of layer.filters) {
          expect(filter.frequency).toBeGreaterThan(0);
        }
      }
    }
  });

  it('reverbMix is always a valid 0-1 wet/dry ratio', () => {
    for (const s of SOUNDSCAPES) {
      expect(s.reverbMix).toBeGreaterThanOrEqual(0);
      expect(s.reverbMix).toBeLessThanOrEqual(1);
    }
  });

  it('an enabled motion profile always has a positive radius and period', () => {
    for (const s of SOUNDSCAPES) {
      if (s.motion.enabled) {
        expect(s.motion.radius).toBeGreaterThan(0);
        expect(s.motion.periodSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('includes the sounds explicitly asked for — rain, waves, a river, thunderstorms', () => {
    const names = SOUNDSCAPES.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes('rain'))).toBe(true);
    expect(names.some((n) => n.includes('ocean') || n.includes('wave'))).toBe(true);
    expect(names.some((n) => n.includes('river'))).toBe(true);
    expect(names.some((n) => n.includes('thunder'))).toBe(true);
  });

  it('only the thunderstorm schedules real thunderclaps', () => {
    const thunder = SOUNDSCAPES.filter((s) => s.hasThunder);
    expect(thunder).toHaveLength(1);
    expect(thunder[0].id).toBe('thunderstorm');
  });

  it('every impulse layer (rain droplets, fire pops) has real, valid parameters', () => {
    for (const s of SOUNDSCAPES) {
      for (const layer of s.impulseLayers ?? []) {
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.gain).toBeLessThanOrEqual(1);
        for (const filter of layer.filters) expect(filter.frequency).toBeGreaterThan(0);
        expect(layer.impulse.density).toBeGreaterThan(0);
        expect(layer.impulse.minDurationSeconds).toBeGreaterThan(0);
        expect(layer.impulse.maxDurationSeconds).toBeGreaterThanOrEqual(layer.impulse.minDurationSeconds);
        expect(layer.impulse.minGain).toBeGreaterThan(0);
        expect(layer.impulse.maxGain).toBeGreaterThanOrEqual(layer.impulse.minGain);
        expect(layer.impulse.maxGain).toBeLessThanOrEqual(1);
        expect(layer.impulse.decayRate).toBeGreaterThan(0);
      }
    }
  });

  it('every wander target aims at a real layer this same soundscape actually has', () => {
    for (const s of SOUNDSCAPES) {
      const realLayerIds = new Set([...s.layers.map((l) => l.id), ...(s.impulseLayers ?? []).map((l) => l.id)]);
      for (const target of s.wander ?? []) {
        expect(realLayerIds.has(target.layerId)).toBe(true);
        expect(target.minValue).toBeLessThan(target.maxValue);
        expect(target.minSegmentSeconds).toBeGreaterThan(0);
        expect(target.maxSegmentSeconds).toBeGreaterThanOrEqual(target.minSegmentSeconds);
      }
    }
  });

  it('rain, thunderstorm, and fireplace get real droplet/crackle transients, not just filtered noise', () => {
    for (const id of ['rain', 'thunderstorm', 'fireplace']) {
      expect(getSoundscape(id).impulseLayers?.length).toBeGreaterThan(0);
    }
  });

  it('ocean and wind get real live gain/filter wander, not a static texture', () => {
    for (const id of ['ocean', 'wind']) {
      expect(getSoundscape(id).wander?.length).toBeGreaterThan(0);
    }
  });
});

describe('getSoundscape', () => {
  it('finds a soundscape by id', () => {
    expect(getSoundscape('rain')?.name).toBe('Rain');
  });

  it('returns undefined for an unknown id', () => {
    expect(getSoundscape('does-not-exist')).toBeUndefined();
  });
});
