import { describe, expect, it } from 'vitest';
import { getBlockInfo } from '../../../js/features/programs/periodization.js';

describe('getBlockInfo', () => {
  it('weeks 1-3 are block 1, progressive, not a deload', () => {
    expect(getBlockInfo(1)).toMatchObject({ blockNumber: 1, weekInBlock: 1, isDeload: false });
    expect(getBlockInfo(2)).toMatchObject({ blockNumber: 1, weekInBlock: 2, isDeload: false });
    expect(getBlockInfo(3)).toMatchObject({ blockNumber: 1, weekInBlock: 3, isDeload: false });
  });

  it('week 4 is the deload week closing block 1', () => {
    expect(getBlockInfo(4)).toMatchObject({ blockNumber: 1, weekInBlock: 4, isDeload: true });
  });

  it('week 5 starts a fresh block 2 at week-in-block 1', () => {
    expect(getBlockInfo(5)).toMatchObject({ blockNumber: 2, weekInBlock: 1, isDeload: false });
  });

  it('week 8 is block 2\'s deload; week 12 is block 3\'s', () => {
    expect(getBlockInfo(8)).toMatchObject({ blockNumber: 2, weekInBlock: 4, isDeload: true });
    expect(getBlockInfo(12)).toMatchObject({ blockNumber: 3, weekInBlock: 4, isDeload: true });
  });

  it('load multiplier rises across the block then drops on the deload', () => {
    const w1 = getBlockInfo(1).loadMultiplier;
    const w2 = getBlockInfo(2).loadMultiplier;
    const w3 = getBlockInfo(3).loadMultiplier;
    const w4 = getBlockInfo(4).loadMultiplier;
    expect(w2).toBeGreaterThan(w1);
    expect(w3).toBeGreaterThan(w2);
    expect(w4).toBeLessThan(w1);
  });

  it('the pattern repeats identically for the equivalent week of every block', () => {
    expect(getBlockInfo(1).loadMultiplier).toBe(getBlockInfo(5).loadMultiplier);
    expect(getBlockInfo(4).isDeload).toBe(getBlockInfo(8).isDeload);
  });

  it('rejects a non-positive or non-integer week number', () => {
    expect(() => getBlockInfo(0)).toThrow();
    expect(() => getBlockInfo(-1)).toThrow();
    expect(() => getBlockInfo(1.5)).toThrow();
  });
});
