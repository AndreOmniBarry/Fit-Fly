import { describe, expect, it } from 'vitest';
import { getMovementDemoSvgMarkup } from '../../../js/features/exercises/movement-demo-svg.js';
import { MOVEMENT_CATEGORIES } from '../../../js/features/exercises/movement-category.js';

describe('getMovementDemoSvgMarkup', () => {
  it('returns real, looping SVG markup for every recognized movement category', () => {
    for (const category of MOVEMENT_CATEGORIES) {
      const markup = getMovementDemoSvgMarkup(category);
      expect(markup).toContain('<svg');
      expect(markup).toContain('repeatCount="indefinite"'); // it loops, not a one-shot animation
      expect(markup).toContain(`data-movement-category="${category}"`);
    }
  });

  it('returns null for an unrecognized category rather than fabricating a generic figure', () => {
    expect(getMovementDemoSvgMarkup('not-a-real-category')).toBeNull();
  });

  it('every category gets a distinct label, not one generic animation reused everywhere', () => {
    const labels = MOVEMENT_CATEGORIES.map((category) => {
      const markup = getMovementDemoSvgMarkup(category);
      return markup.match(/aria-label="([^"]+)"/)[1];
    });
    expect(new Set(labels).size).toBe(MOVEMENT_CATEGORIES.length);
  });

  it('a hold demo is a real near-static breathing loop, not a rapid rep cycle like a strength pattern', () => {
    const hold = getMovementDemoSvgMarkup('hold');
    const squat = getMovementDemoSvgMarkup('squat');
    const holdDur = hold.match(/dur="([\d.]+)s"/)[1];
    const squatDur = squat.match(/dur="([\d.]+)s"/)[1];
    expect(Number(holdDur)).toBeGreaterThan(Number(squatDur));
  });

  it('a cardio demo runs at a brisk, distinctly faster cadence than a mobility stretch', () => {
    const cardio = getMovementDemoSvgMarkup('cardio');
    const mobility = getMovementDemoSvgMarkup('mobility');
    const cardioDur = Number(cardio.match(/dur="([\d.]+)s"/)[1]);
    const mobilityDur = Number(mobility.match(/dur="([\d.]+)s"/)[1]);
    expect(cardioDur).toBeLessThan(mobilityDur);
  });

  it('reduceMotion strips every animation but keeps a real static figure for the category', () => {
    for (const category of MOVEMENT_CATEGORIES) {
      const markup = getMovementDemoSvgMarkup(category, { reduceMotion: true });
      expect(markup).toContain('<svg');
      expect(markup).toContain(`data-movement-category="${category}"`);
      expect(markup).not.toContain('<animate');
    }
  });

  it('is pure and deterministic: the same category always returns identical markup', () => {
    expect(getMovementDemoSvgMarkup('push')).toBe(getMovementDemoSvgMarkup('push'));
  });
});
