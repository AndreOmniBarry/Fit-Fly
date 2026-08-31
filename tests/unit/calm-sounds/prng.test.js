import { describe, expect, it } from 'vitest';
import { createPrng } from '../../../js/features/calm-sounds/prng.js';

describe('createPrng', () => {
  it('produces values in [0, 1)', () => {
    const rng = createPrng(42);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = createPrng(7);
    const b = createPrng(7);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = createPrng(1);
    const b = createPrng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});
