import { describe, expect, it } from 'vitest';
import { AUTOREGULATION_DIRECTION, suggestNextLoadAdjustment } from '../../../js/features/programs/autoregulation.js';

function set({ reps = 8, weightKg = 40, rir, completedAt }) {
  return { reps, weightKg, rir, completedAt };
}

describe('suggestNextLoadAdjustment', () => {
  it('returns null with no sets at all — no data, no fabricated suggestion', () => {
    expect(suggestNextLoadAdjustment([])).toBeNull();
  });

  it('returns null when no set has ever been RIR-tagged', () => {
    const sets = [
      set({ rir: null, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: undefined, completedAt: '2026-03-02T09:00:00' }),
    ];
    expect(suggestNextLoadAdjustment(sets)).toBeNull();
  });

  it('returns null for a non-array input, rather than throwing', () => {
    expect(suggestNextLoadAdjustment(null)).toBeNull();
    expect(suggestNextLoadAdjustment(undefined)).toBeNull();
  });

  it('ignores RIR-tagged sets with no real weight (e.g. a bodyweight 0kg placeholder)', () => {
    const sets = [
      set({ weightKg: 0, rir: 3, completedAt: '2026-03-01T09:00:00' }),
      set({ weightKg: null, rir: 3, completedAt: '2026-03-02T09:00:00' }),
    ];
    expect(suggestNextLoadAdjustment(sets)).toBeNull();
  });

  it('suggests trying heavier when the recent RIR-tagged sets consistently ran high (>= 3 RIR)', () => {
    const sets = [
      set({ rir: 3, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: 4, completedAt: '2026-03-02T09:00:00' }),
      set({ rir: 3, completedAt: '2026-03-03T09:00:00' }),
    ];
    const result = suggestNextLoadAdjustment(sets);
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.HEAVIER);
    expect(result.message).toContain('heavier');
    expect(result.basedOnSetCount).toBe(3);
    // averageRir is deliberately rounded to 1 decimal (see the module's
    // own doc comment on not implying false precision).
    expect(result.averageRir).toBeCloseTo((3 + 4 + 3) / 3, 1);
  });

  it('suggests holding steady or easing off when recent sets consistently ran at/near failure (<= 1 RIR)', () => {
    const sets = [
      set({ rir: 0, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: 1, completedAt: '2026-03-02T09:00:00' }),
      set({ rir: 0, completedAt: '2026-03-03T09:00:00' }),
    ];
    const result = suggestNextLoadAdjustment(sets);
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.EASE);
    expect(result.message).toMatch(/holding steady|easing off/);
    // Never phrased as "go heavier" for a near-failure pattern.
    expect(result.message).not.toContain('trying a bit heavier');
  });

  it('suggests holding steady when recent sets consistently landed at a moderate 2 RIR', () => {
    const sets = [
      set({ rir: 2, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: 2, completedAt: '2026-03-02T09:00:00' }),
    ];
    const result = suggestNextLoadAdjustment(sets);
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.HOLD);
    expect(result.message).toContain('hold steady');
  });

  it('reports a real, explicit "mixed" direction for genuinely inconsistent recent effort, rather than silently guessing', () => {
    const sets = [
      set({ rir: 0, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: 4, completedAt: '2026-03-02T09:00:00' }),
      set({ rir: 1, completedAt: '2026-03-03T09:00:00' }),
    ];
    const result = suggestNextLoadAdjustment(sets);
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.MIXED);
    expect(result.message).toContain('not a clear enough pattern');
  });

  it('gives an honest suggestion from a single RIR-tagged set when that is all the real data there is', () => {
    const sets = [set({ rir: 4, completedAt: '2026-03-01T09:00:00' })];
    const result = suggestNextLoadAdjustment(sets);
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.HEAVIER);
    expect(result.basedOnSetCount).toBe(1);
    expect(result.message).toContain('1 RIR-tagged set '); // singular, not "sets"
  });

  it('only considers the most recent window of RIR-tagged sets, regardless of array order', () => {
    // Four RIR-tagged sets, oldest first in the array on purpose — an old
    // near-failure run from weeks ago should not drag down a suggestion
    // once the three most recent sets have consistently had real room left.
    const sets = [
      set({ rir: 0, completedAt: '2026-02-01T09:00:00' }),
      set({ rir: 0, completedAt: '2026-02-08T09:00:00' }),
      set({ rir: 3, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: 4, completedAt: '2026-03-08T09:00:00' }),
      set({ rir: 3, completedAt: '2026-03-15T09:00:00' }),
    ];
    const result = suggestNextLoadAdjustment(sets);
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.HEAVIER);
    expect(result.basedOnSetCount).toBe(3);
  });

  it('never mistakes rir: 0 for "no data" (0 is a real, meaningful RIR value, not a falsy placeholder)', () => {
    const sets = [
      set({ rir: 0, completedAt: '2026-03-01T09:00:00' }),
      set({ rir: 0, completedAt: '2026-03-02T09:00:00' }),
    ];
    const result = suggestNextLoadAdjustment(sets);
    expect(result).not.toBeNull();
    expect(result.direction).toBe(AUTOREGULATION_DIRECTION.EASE);
  });
});
