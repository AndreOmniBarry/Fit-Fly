import { describe, expect, it } from 'vitest';
import { positionAtTime } from '../../../js/features/calm-sounds/spatial-motion.js';

function magnitude(v) {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

describe('positionAtTime: disabled motion', () => {
  it('returns a fixed point straight ahead at the given radius', () => {
    const profile = { enabled: false, radius: 2, plane: 'xz', periodSeconds: 10 };
    const p0 = positionAtTime(profile, 0);
    const p5 = positionAtTime(profile, 5);
    expect(p0).toEqual({ x: 0, y: 0, z: -2 });
    expect(p5).toEqual(p0);
  });
});

describe('positionAtTime: enabled motion', () => {
  it('stays at a constant distance from the listener (traces a circle)', () => {
    const profile = { enabled: true, radius: 3, plane: 'xz', periodSeconds: 12 };
    for (let t = 0; t < 12; t += 1) {
      expect(magnitude(positionAtTime(profile, t))).toBeCloseTo(3, 5);
    }
  });

  it('is periodic — position repeats every periodSeconds', () => {
    const profile = { enabled: true, radius: 2, plane: 'xy', periodSeconds: 8 };
    const p = positionAtTime(profile, 3);
    const pNextCycle = positionAtTime(profile, 3 + 8);
    expect(pNextCycle.x).toBeCloseTo(p.x, 8);
    expect(pNextCycle.y).toBeCloseTo(p.y, 8);
    expect(pNextCycle.z).toBeCloseTo(p.z, 8);
  });

  it('moves within the declared plane only (the third axis stays at the offset)', () => {
    const profile = { enabled: true, radius: 2, plane: 'xz', periodSeconds: 10, offsetAxis: 0.5 };
    const p = positionAtTime(profile, 2.5);
    expect(p.y).toBe(0.5);
  });

  it('actually changes position over time, not a disguised fixed point', () => {
    const profile = { enabled: true, radius: 2, plane: 'xz', periodSeconds: 10 };
    const p0 = positionAtTime(profile, 0);
    const p2 = positionAtTime(profile, 2.5);
    expect(p0).not.toEqual(p2);
  });
});
