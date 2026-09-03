import { describe, expect, it } from 'vitest';
import { assessGpsSignalQuality, GPS_SIGNAL_QUALITY } from '../../../js/features/run/gps-signal-quality.js';

describe('assessGpsSignalQuality', () => {
  it('reports "acquiring" before any fix has arrived (null accuracy)', () => {
    expect(assessGpsSignalQuality(null).level).toBe(GPS_SIGNAL_QUALITY.ACQUIRING);
    expect(assessGpsSignalQuality(undefined).level).toBe(GPS_SIGNAL_QUALITY.ACQUIRING);
  });

  it('reports "acquiring" for a non-finite accuracy rather than crashing on it', () => {
    expect(assessGpsSignalQuality(NaN).level).toBe(GPS_SIGNAL_QUALITY.ACQUIRING);
  });

  it('reports "strong" for a tight fix', () => {
    const result = assessGpsSignalQuality(5);
    expect(result.level).toBe(GPS_SIGNAL_QUALITY.STRONG);
    expect(result.message).toContain('±5m');
  });

  it('reports "strong" right at the boundary', () => {
    expect(assessGpsSignalQuality(10).level).toBe(GPS_SIGNAL_QUALITY.STRONG);
  });

  it('reports "fair" just past the strong boundary', () => {
    const result = assessGpsSignalQuality(11);
    expect(result.level).toBe(GPS_SIGNAL_QUALITY.FAIR);
    expect(result.message).toContain('±11m');
  });

  it('reports "fair" right at the filterAccuratePoints cutoff', () => {
    expect(assessGpsSignalQuality(30).level).toBe(GPS_SIGNAL_QUALITY.FAIR);
  });

  it('reports "weak" past the cutoff that filterAccuratePoints itself uses to drop a fix', () => {
    const result = assessGpsSignalQuality(45);
    expect(result.level).toBe(GPS_SIGNAL_QUALITY.WEAK);
    expect(result.message).toContain('dropped');
  });
});
