import { describe, expect, it } from 'vitest';
import {
  averageCycleLengthDays,
  currentCyclePhase,
  predictFertileWindow,
  predictionConfidence,
  predictNextPeriodStart,
} from '../../../js/features/womens-health/cycle-prediction.js';

const REGULAR_28_DAY_HISTORY = ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24', '2026-08-21'];

describe('averageCycleLengthDays', () => {
  it('is null with fewer than 2 logged periods', () => {
    expect(averageCycleLengthDays([])).toBeNull();
    expect(averageCycleLengthDays(['2026-05-01'])).toBeNull();
  });

  it('averages the gaps between consecutive periods', () => {
    expect(averageCycleLengthDays(['2026-05-01', '2026-05-29'])).toBe(28);
    expect(averageCycleLengthDays(REGULAR_28_DAY_HISTORY)).toBe(28);
  });

  it('sorts unsorted input before computing gaps', () => {
    const shuffled = ['2026-06-26', '2026-05-01', '2026-05-29'];
    expect(averageCycleLengthDays(shuffled)).toBe(28);
  });
});

describe('predictionConfidence', () => {
  it('is "low" with fewer than 2 gaps to measure (0 or 1 logged periods)', () => {
    expect(predictionConfidence([])).toBe('low');
    expect(predictionConfidence(['2026-05-01'])).toBe('low');
    expect(predictionConfidence(['2026-05-01', '2026-05-29'])).toBe('low'); // exactly 1 gap
  });

  it('is "high" with a longer, consistent history', () => {
    expect(predictionConfidence(REGULAR_28_DAY_HISTORY)).toBe('high');
  });

  it('is "low" for a highly irregular history, even with several cycles logged', () => {
    const irregular = ['2026-01-01', '2026-01-25', '2026-03-10', '2026-03-20', '2026-05-15'];
    expect(predictionConfidence(irregular)).toBe('low');
  });
});

describe('predictNextPeriodStart', () => {
  it('is null with no history at all', () => {
    expect(predictNextPeriodStart([])).toBeNull();
  });

  it('uses a default assumed cycle length off a single logged period', () => {
    expect(predictNextPeriodStart(['2026-08-01'])).toBe('2026-08-29'); // +28 days default
  });

  it('extrapolates from the average of a real history', () => {
    expect(predictNextPeriodStart(REGULAR_28_DAY_HISTORY)).toBe('2026-09-18'); // last (08-21) + 28
  });

  it('a custom default cycle length is honored for a single-period history', () => {
    expect(predictNextPeriodStart(['2026-08-01'], { defaultCycleLengthDays: 30 })).toBe('2026-08-31');
  });
});

describe('predictFertileWindow', () => {
  it('is null with no history', () => {
    expect(predictFertileWindow([])).toBeNull();
  });

  it('places ovulation 14 days before the predicted next period, with a 5-before/1-after window', () => {
    const window = predictFertileWindow(REGULAR_28_DAY_HISTORY);
    // next period predicted 2026-09-18 -> ovulation 2026-09-04
    expect(window.ovulationDate).toBe('2026-09-04');
    expect(window.start).toBe('2026-08-30');
    expect(window.end).toBe('2026-09-05');
  });
});

describe('currentCyclePhase', () => {
  // REGULAR_28_DAY_HISTORY: last start 2026-08-21, predicted next start
  // 2026-09-18, fertile window 2026-08-30 to 2026-09-05.

  it('is null with no history at all', () => {
    expect(currentCyclePhase([], '2026-08-25')).toBeNull();
  });

  it('is null for a date before the most recent logged period start', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-20')).toBeNull();
  });

  it('day 1 is the period start date itself', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-21')).toEqual({
      cycleDayNumber: 1,
      phase: 'follicular',
    });
  });

  it('is follicular between the period and the fertile window', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-25')).toEqual({
      cycleDayNumber: 5,
      phase: 'follicular',
    });
  });

  it('is fertile across the whole estimated fertile window, inclusive both ends', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-30')).toEqual({
      cycleDayNumber: 10,
      phase: 'fertile',
    });
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-09-05')).toEqual({
      cycleDayNumber: 16,
      phase: 'fertile',
    });
  });

  it('is luteal after the fertile window, before the next predicted period', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-09-06')).toEqual({
      cycleDayNumber: 17,
      phase: 'luteal',
    });
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-09-17')).toEqual({
      cycleDayNumber: 28,
      phase: 'luteal',
    });
  });

  it('is null once at or past the predicted next period start — genuinely uncertain, not guessed', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-09-18')).toBeNull();
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-10-01')).toBeNull();
  });

  it('still gives a real phase off a single logged period, using the default assumed cycle length', () => {
    expect(currentCyclePhase(['2026-08-01'], '2026-08-03')).toEqual({
      cycleDayNumber: 3,
      phase: 'follicular',
    });
  });
});
