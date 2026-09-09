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

  it('reduceMotion leaves a real, visible resting pose — every path keeps a real d, every circle a real cx/cy, never the SVG default of "nothing drawn" / "0,0"', () => {
    for (const category of MOVEMENT_CATEGORIES) {
      const markup = getMovementDemoSvgMarkup(category, { reduceMotion: true });
      // A <path> with no d attribute at all renders nothing — this
      // matches an empty/missing d specifically, not just any d="".
      expect(markup).not.toMatch(/<path(?![^>]*\bd=)[^>]*\/>/);
      // A <circle> with no cx/cy defaults to the viewBox's (0,0) corner.
      expect(markup).not.toMatch(/<circle(?![^>]*\bcx=)[^>]*\/>/);
      expect(markup).not.toMatch(/<circle(?![^>]*\bcy=)[^>]*\/>/);
    }
  });

  it('every category gets real, visible joint markers at the shoulder and hip — not just a bare limb skeleton', () => {
    for (const category of MOVEMENT_CATEGORIES) {
      const markup = getMovementDemoSvgMarkup(category);
      const jointCircleCount = (markup.match(/<circle[^>]*r="4"/g) ?? []).length;
      expect(jointCircleCount).toBeGreaterThanOrEqual(2); // shoulder + hip, at minimum
    }
  });

  it('the torso renders with real visual weight — a thicker stroke than the limbs, not a uniform matchstick line', () => {
    for (const category of MOVEMENT_CATEGORIES) {
      const markup = getMovementDemoSvgMarkup(category);
      expect(markup).toContain('stroke-width="10"'); // TORSO_STYLE
      expect(markup).toContain('stroke-width="7"'); // LIMB_STYLE
    }
  });
});
