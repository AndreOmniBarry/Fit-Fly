import { describe, expect, it } from 'vitest';
import { getSoundscape, SOUNDSCAPES } from '../../../js/features/calm-sounds/soundscapes.js';

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

  it('includes the sounds explicitly asked for — rain, waves, a river', () => {
    const names = SOUNDSCAPES.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes('rain'))).toBe(true);
    expect(names.some((n) => n.includes('ocean') || n.includes('wave'))).toBe(true);
    expect(names.some((n) => n.includes('river'))).toBe(true);
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
