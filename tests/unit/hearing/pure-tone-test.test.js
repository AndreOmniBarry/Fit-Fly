import { describe, expect, it } from 'vitest';
import {
  compareThresholdChange,
  createAscendingStaircase,
  flagElevatedThresholds,
  notDetectedResults,
} from '../../../js/features/hearing/pure-tone-test.js';

describe('createAscendingStaircase', () => {
  it('starts at the configured start gain, not finished', () => {
    const staircase = createAscendingStaircase({ startGain: 0.1, stepGain: 0.1, maxGain: 1 });
    expect(staircase.getCurrentGain()).toBe(0.1);
    expect(staircase.isFinished()).toBe(false);
    expect(staircase.getThresholdGain()).toBeNull();
  });

  it('records the current gain as the threshold the moment it\'s reported heard', () => {
    const staircase = createAscendingStaircase({ startGain: 0.1, stepGain: 0.1, maxGain: 1 });
    staircase.reportNotHeard();
    expect(staircase.getCurrentGain()).toBeCloseTo(0.2, 5);
    staircase.reportHeard();
    expect(staircase.isFinished()).toBe(true);
    expect(staircase.getThresholdGain()).toBeCloseTo(0.2, 5);
  });

  it('steps up by stepGain each time it\'s not heard, clamped to maxGain', () => {
    const staircase = createAscendingStaircase({ startGain: 0.9, stepGain: 0.2, maxGain: 1 });
    staircase.reportNotHeard();
    expect(staircase.getCurrentGain()).toBe(1); // clamped, not 1.1
  });

  it('finishes with a null threshold only after a real trial at max gain also goes unheard — never a fabricated threshold from arithmetic overflow alone', () => {
    const staircase = createAscendingStaircase({ startGain: 0.9, stepGain: 0.2, maxGain: 1 });
    staircase.reportNotHeard(); // steps up to (clamped) max gain — a real trial at max still needs to happen
    expect(staircase.getCurrentGain()).toBe(1);
    expect(staircase.isFinished()).toBe(false);

    staircase.reportNotHeard(); // that max-gain trial also wasn't heard
    expect(staircase.isFinished()).toBe(true);
    expect(staircase.getThresholdGain()).toBeNull();
  });

  it('ignores further reports once finished', () => {
    const staircase = createAscendingStaircase({ startGain: 0.1, stepGain: 0.1, maxGain: 1 });
    staircase.reportHeard();
    staircase.reportNotHeard(); // should be a no-op
    expect(staircase.getThresholdGain()).toBeCloseTo(0.1, 5);
  });
});

describe('flagElevatedThresholds', () => {
  it('flags nothing with fewer than 2 real thresholds to compare', () => {
    expect(flagElevatedThresholds([])).toEqual([]);
    expect(flagElevatedThresholds([{ frequencyHz: 1000, ear: 'left', thresholdGain: 0.2 }])).toEqual([]);
  });

  it('flags a frequency notably higher than this same test\'s own best', () => {
    const results = [
      { frequencyHz: 250, ear: 'left', thresholdGain: 0.1 },
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.12 },
      { frequencyHz: 4000, ear: 'left', thresholdGain: 0.45 }, // a real 0.35 gap — notably elevated
      { frequencyHz: 8000, ear: 'left', thresholdGain: null }, // never heard — excluded, not treated as 0 or infinity
    ];
    expect(flagElevatedThresholds(results)).toEqual([4000]);
  });

  it('flags nothing when every frequency is close together', () => {
    const results = [
      { frequencyHz: 250, ear: 'left', thresholdGain: 0.1 },
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.14 },
      { frequencyHz: 4000, ear: 'left', thresholdGain: 0.18 },
    ];
    expect(flagElevatedThresholds(results)).toEqual([]);
  });

  it('never duplicates a frequency flagged from both ears', () => {
    const results = [
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.1 },
      { frequencyHz: 4000, ear: 'left', thresholdGain: 0.5 },
      { frequencyHz: 4000, ear: 'right', thresholdGain: 0.55 },
    ];
    expect(flagElevatedThresholds(results)).toEqual([4000]);
  });
});

describe('notDetectedResults', () => {
  it('is empty when every frequency was heard', () => {
    const results = [
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.2 },
      { frequencyHz: 4000, ear: 'left', thresholdGain: 0.5 },
    ];
    expect(notDetectedResults(results)).toEqual([]);
  });

  it('surfaces a never-heard frequency/ear as its own, undiluted result — never merged into "elevated"', () => {
    const results = [
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.2 },
      { frequencyHz: 8000, ear: 'right', thresholdGain: null },
    ];
    expect(notDetectedResults(results)).toEqual([{ frequencyHz: 8000, ear: 'right' }]);
    // and it must never show up as merely "elevated", the milder signal
    expect(flagElevatedThresholds(results)).toEqual([]);
  });

  it('keeps both ears separate — asymmetry is itself a real signal', () => {
    const results = [
      { frequencyHz: 8000, ear: 'left', thresholdGain: null },
      { frequencyHz: 8000, ear: 'right', thresholdGain: 0.3 },
    ];
    expect(notDetectedResults(results)).toEqual([{ frequencyHz: 8000, ear: 'left' }]);
  });
});

describe('compareThresholdChange', () => {
  it('is empty when nothing meaningfully worsened', () => {
    const earlier = [{ frequencyHz: 4000, ear: 'left', thresholdGain: 0.2 }];
    const later = [{ frequencyHz: 4000, ear: 'left', thresholdGain: 0.22 }]; // trivial change
    expect(compareThresholdChange(earlier, later)).toEqual([]);
  });

  it('flags a real, meaningful increase at the same frequency/ear', () => {
    const earlier = [{ frequencyHz: 4000, ear: 'left', thresholdGain: 0.2 }];
    const later = [{ frequencyHz: 4000, ear: 'left', thresholdGain: 0.4 }];
    const changes = compareThresholdChange(earlier, later);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ frequencyHz: 4000, ear: 'left', earlierGain: 0.2, laterGain: 0.4 });
    expect(changes[0].worsenedByGain).toBeCloseTo(0.2, 5);
  });

  it('flags "couldn\'t hear it at all this time" as a real worsening, not a skip', () => {
    const earlier = [{ frequencyHz: 8000, ear: 'right', thresholdGain: 0.3 }];
    const later = [{ frequencyHz: 8000, ear: 'right', thresholdGain: null }];
    const changes = compareThresholdChange(earlier, later);
    expect(changes).toHaveLength(1);
    expect(changes[0].laterGain).toBeNull();
  });

  it('skips a combination with no earlier real threshold to compare against', () => {
    const earlier = [{ frequencyHz: 4000, ear: 'left', thresholdGain: null }];
    const later = [{ frequencyHz: 4000, ear: 'left', thresholdGain: 0.9 }];
    expect(compareThresholdChange(earlier, later)).toEqual([]);
  });

  it('skips a frequency/ear missing from the later test entirely', () => {
    const earlier = [{ frequencyHz: 4000, ear: 'left', thresholdGain: 0.2 }];
    expect(compareThresholdChange(earlier, [])).toEqual([]);
  });

  it('sorts the most-worsened combination first', () => {
    const earlier = [
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.2 },
      { frequencyHz: 4000, ear: 'left', thresholdGain: 0.2 },
    ];
    const later = [
      { frequencyHz: 1000, ear: 'left', thresholdGain: 0.4 }, // +0.2
      { frequencyHz: 4000, ear: 'left', thresholdGain: 0.6 }, // +0.4
    ];
    const changes = compareThresholdChange(earlier, later);
    expect(changes.map((c) => c.frequencyHz)).toEqual([4000, 1000]);
  });
});
