import { describe, expect, it } from 'vitest';
import { summarizeHeartRateTrend } from '../../../js/features/heart-rate/trend.js';

describe('summarizeHeartRateTrend', () => {
  it('is null with no readings at all', () => {
    expect(summarizeHeartRateTrend([])).toBeNull();
  });

  it('a single reading has a latest/average/min/max equal to itself, and no delta to compare against', () => {
    const result = summarizeHeartRateTrend([{ bpm: 68 }]);
    expect(result).toEqual({
      latest: 68,
      average: 68,
      min: 68,
      max: 68,
      deltaFromPrevious: null,
      sampleCount: 1,
      sparklineOldestFirst: [68],
    });
  });

  it('computes a real average/min/max/delta across several readings, newest first', () => {
    const result = summarizeHeartRateTrend([{ bpm: 80 }, { bpm: 70 }, { bpm: 60 }]);
    expect(result.latest).toBe(80);
    expect(result.average).toBe(70);
    expect(result.min).toBe(60);
    expect(result.max).toBe(80);
    expect(result.deltaFromPrevious).toBe(10); // 80 - 70
    expect(result.sampleCount).toBe(3);
    expect(result.sparklineOldestFirst).toEqual([60, 70, 80]); // chronological, oldest first
  });

  it('a lower latest reading than the previous one gives a negative delta', () => {
    const result = summarizeHeartRateTrend([{ bpm: 60 }, { bpm: 75 }]);
    expect(result.deltaFromPrevious).toBe(-15);
  });

  it('only ever looks at the most recent windowSize readings, ignoring older ones', () => {
    const samples = [{ bpm: 100 }, { bpm: 90 }, { bpm: 80 }, { bpm: 999 }]; // the 999 is deliberately outside the window
    const result = summarizeHeartRateTrend(samples, 3);
    expect(result.sampleCount).toBe(3);
    expect(result.max).toBe(100);
    expect(result.average).toBe(90); // (100+90+80)/3, not including 999
  });

  it('carries the latest reading\'s own source and confidence — the hero number must stay honest about itself', () => {
    const camera = summarizeHeartRateTrend([{ bpm: 72, source: 'camera-ppg', confidence: 'medium' }]);
    expect(camera.latestSource).toBe('camera-ppg');
    expect(camera.latestConfidence).toBe('medium');

    const ble = summarizeHeartRateTrend([{ bpm: 72, source: 'ble', confidence: null }]);
    expect(ble.latestSource).toBe('ble');
    expect(ble.latestConfidence).toBeNull();
  });

  it('a newer BLE reading\'s source overrides an older camera reading\'s, not the other way around', () => {
    const result = summarizeHeartRateTrend([
      { bpm: 70, source: 'ble', confidence: null },
      { bpm: 75, source: 'camera-ppg', confidence: 'high' },
    ]);
    expect(result.latestSource).toBe('ble');
  });
});
