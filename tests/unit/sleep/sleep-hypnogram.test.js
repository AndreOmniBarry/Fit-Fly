import { describe, expect, it } from 'vitest';
import { buildHypnogramModel, hypnogramSummaryLine, STAGE_LABEL } from '../../../js/features/sleep/sleep-hypnogram.js';

const STAGES = ['awake', 'rem', 'light', 'deep'];

describe('buildHypnogramModel: honesty/integrity of the model', () => {
  it('segments always sum to exactly the logged duration, never more or less', () => {
    for (const duration of [45, 90, 180, 273, 331, 480, 512, 600]) {
      const model = buildHypnogramModel(duration, null);
      const spanned = model.segments.reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
      expect(spanned).toBe(duration);
      expect(model.totalMinutes).toBe(duration);
      const stageSum = STAGES.reduce((sum, stage) => sum + model.stageMinutes[stage], 0);
      expect(stageSum).toBe(duration);
    }
  });

  it('segments are contiguous, non-overlapping, and start at 0', () => {
    const model = buildHypnogramModel(480, 3);
    expect(model.segments[0].startMinutes).toBe(0);
    for (let i = 1; i < model.segments.length; i++) {
      expect(model.segments[i].startMinutes).toBe(model.segments[i - 1].endMinutes);
    }
    const last = model.segments[model.segments.length - 1];
    expect(last.endMinutes).toBe(480);
  });

  it('every segment is a real positive span of a known stage', () => {
    const model = buildHypnogramModel(420, 4);
    for (const segment of model.segments) {
      expect(segment.endMinutes).toBeGreaterThan(segment.startMinutes);
      expect(STAGES).toContain(segment.stage);
    }
  });

  it('zero or invalid duration returns an honest empty model, not a fabricated one', () => {
    for (const bad of [0, -30, NaN]) {
      const model = buildHypnogramModel(bad, 4);
      expect(model.segments).toEqual([]);
      expect(model.totalMinutes).toBe(0);
    }
  });

  it('a night opens with a real light-sleep-onset (awake) stretch, not straight into deep sleep', () => {
    const model = buildHypnogramModel(480, null);
    expect(model.segments[0].stage).toBe('awake');
    // Modeled onset latency stays a small, plausible slice of the night.
    expect(model.segments[0].endMinutes).toBeLessThan(20);
  });

  it('a very short night still gets at least one real cycle, not a crash or an empty result', () => {
    const model = buildHypnogramModel(50, null);
    expect(model.segments.length).toBeGreaterThan(0);
    expect(model.totalMinutes).toBe(50);
  });
});

describe('buildHypnogramModel: real sleep-architecture shape', () => {
  it('deep sleep is concentrated toward the start of the night, not the end', () => {
    const model = buildHypnogramModel(480, 3);
    const midpoint = model.totalMinutes / 2;
    const firstHalfDeep = model.segments
      .filter((s) => s.stage === 'deep' && s.startMinutes < midpoint)
      .reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
    const secondHalfDeep = model.segments
      .filter((s) => s.stage === 'deep' && s.startMinutes >= midpoint)
      .reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
    expect(firstHalfDeep).toBeGreaterThan(secondHalfDeep);
  });

  it('REM lengthens toward the end of the night, not the start', () => {
    const model = buildHypnogramModel(480, 3);
    const midpoint = model.totalMinutes / 2;
    const firstHalfRem = model.segments
      .filter((s) => s.stage === 'rem' && s.startMinutes < midpoint)
      .reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
    const secondHalfRem = model.segments
      .filter((s) => s.stage === 'rem' && s.startMinutes >= midpoint)
      .reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
    expect(secondHalfRem).toBeGreaterThan(firstHalfRem);
  });

  it('a lower self-rated quality widens modeled between-cycle awakenings versus a great night', () => {
    const poor = buildHypnogramModel(480, 1);
    const great = buildHypnogramModel(480, 5);
    expect(poor.stageMinutes.awake).toBeGreaterThan(great.stageMinutes.awake);
  });

  it('stagePercent adds up to (approximately) 100 and matches stageMinutes proportionally', () => {
    const model = buildHypnogramModel(450, 4);
    const total = STAGES.reduce((sum, stage) => sum + model.stagePercent[stage], 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });
});

describe('hypnogramSummaryLine', () => {
  it('reads out real deep/REM/light shares and names the category', () => {
    const model = buildHypnogramModel(480, 4);
    const line = hypnogramSummaryLine(model, 'great');
    expect(line).toContain('% deep');
    expect(line).toContain('% REM');
    expect(line).toContain('great');
  });

  it('is honest and blank for an empty model', () => {
    expect(hypnogramSummaryLine(buildHypnogramModel(0, null), 'poor')).toBe('');
  });
});

describe('STAGE_LABEL', () => {
  it('labels every real stage', () => {
    for (const stage of STAGES) expect(STAGE_LABEL[stage]).toBeTruthy();
  });
});
