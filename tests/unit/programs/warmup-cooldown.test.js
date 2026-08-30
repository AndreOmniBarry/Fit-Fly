import { describe, expect, it } from 'vitest';
import { getCooldown, getWarmup } from '../../../js/features/programs/warmup-cooldown.js';

describe('getWarmup / getCooldown', () => {
  it('every category gets a non-empty warm-up and cooldown', () => {
    const categories = [
      'sedentary-start',
      'cut-fat-loss',
      'recomposition',
      'rehab-recuperation',
      'hypertrophy',
      'endurance',
    ];
    for (const category of categories) {
      expect(getWarmup(category).length).toBeGreaterThan(0);
      expect(getCooldown(category).length).toBeGreaterThan(0);
    }
  });

  it('rehab-recuperation and sedentary-start get the gentle tier, distinct from the rest', () => {
    expect(getWarmup('rehab-recuperation')).toEqual(getWarmup('sedentary-start'));
    expect(getWarmup('rehab-recuperation')).not.toEqual(getWarmup('hypertrophy'));
  });

  it('the more demanding categories share the same standard tier', () => {
    expect(getWarmup('hypertrophy')).toEqual(getWarmup('endurance'));
    expect(getCooldown('cut-fat-loss')).toEqual(getCooldown('recomposition'));
  });

  it('falls back to the standard tier for an unrecognized category rather than throwing', () => {
    expect(() => getWarmup('not-a-real-category')).not.toThrow();
    expect(getWarmup('not-a-real-category')).toEqual(getWarmup('hypertrophy'));
  });
});
