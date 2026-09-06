import { describe, expect, it } from 'vitest';
import {
  averageCycleLengthDays,
  currentCyclePhase,
  cycleLengthHistory,
  cyclePhaseSegments,
  predictFertileWindow,
  predictionConfidence,
  predictNextPeriodStart,
} from '../../../js/features/womens-health/cycle-prediction.js';

const REGULAR_28_DAY_HISTORY = ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24', '2026-08-21'];

describe('cycleLengthHistory', () => {
  it('is empty with fewer than 2 logged periods', () => {
    expect(cycleLengthHistory([])).toEqual([]);
    expect(cycleLengthHistory(['2026-05-01'])).toEqual([]);
  });

  it('one dated entry per gap between consecutive periods, oldest first', () => {
    expect(cycleLengthHistory(['2026-05-01', '2026-05-29', '2026-06-26'])).toEqual([
      { periodStartDate: '2026-05-29', lengthDays: 28 },
      { periodStartDate: '2026-06-26', lengthDays: 28 },
    ]);
  });

  it('sorts unsorted input before computing gaps', () => {
    const shuffled = ['2026-06-26', '2026-05-01', '2026-05-29'];
    expect(cycleLengthHistory(shuffled).map((h) => h.lengthDays)).toEqual([28, 28]);
  });
});

describe('averageCycleLengthDays', () => {
  it('is null with fewer than 2 logged periods', () => {
    expect(averageCycleLengthDays([])).toBeNull();
    expect(averageCycleLengthDays(['2026-05-01'])).toBeNull();
  });

  it('averages the gaps between consecutive periods', () => {
    expect(averageCycleLengthDays(['2026-05-01', '2026-05-29'])).toBe(28);
    expect(averageCycleLengthDays(REGULAR_28_DAY_HISTORY)).toBe(28);
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
  // 2026-09-18. With the default 5-day period length: menstrual days
  // 1-5 (08-21..08-25), ovulation window days 10-16 (08-30..09-05),
  // luteal days 17-28 (09-06..09-17), follicular the remainder (days
  // 6-9, 08-26..08-29).

  it('is null with no history at all', () => {
    expect(currentCyclePhase([], '2026-08-25')).toBeNull();
  });

  it('is null for a date before every logged period, even the earliest one', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-01-01')).toBeNull();
  });

  it('a date before the *latest* period start, but inside an earlier fully-logged cycle, uses that cycle\'s own real length', () => {
    // Falls inside the 07-24 -> 08-21 cycle (a real, fully-known 28-day
    // cycle), day 28 of it (07-24 + 27 days) -> luteal, not null: past
    // behavior returned null for any date before the latest period start
    // at all, which threw away perfectly good historical data.
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-20')).toEqual({
      cycleDayNumber: 28,
      phase: 'luteal',
    });
  });

  it('day 1 of the period is menstrual, not follicular', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-21')).toEqual({
      cycleDayNumber: 1,
      phase: 'menstrual',
    });
  });

  it('stays menstrual through the estimated period length', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-25')).toEqual({
      cycleDayNumber: 5,
      phase: 'menstrual',
    });
  });

  it('is follicular between the end of menstrual bleeding and the ovulation window', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-28')).toEqual({
      cycleDayNumber: 8,
      phase: 'follicular',
    });
  });

  it('is the ovulation phase across the whole estimated fertile window, inclusive both ends', () => {
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-30')).toEqual({
      cycleDayNumber: 10,
      phase: 'ovulation',
    });
    expect(currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-09-05')).toEqual({
      cycleDayNumber: 16,
      phase: 'ovulation',
    });
  });

  it('is luteal after the ovulation window, before the next predicted period', () => {
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

  it('still gives a real phase off a single logged period (the first-ever entry), using the default assumed cycle length', () => {
    expect(currentCyclePhase(['2026-08-01'], '2026-08-03')).toEqual({
      cycleDayNumber: 3,
      phase: 'menstrual',
    });
    expect(currentCyclePhase(['2026-08-01'], '2026-08-08')).toEqual({
      cycleDayNumber: 8,
      phase: 'follicular',
    });
  });

  it('honors a real, logged average period length instead of the default', () => {
    // A consistently longer real period (7 days) pushes menstrual out
    // further and shrinks follicular accordingly.
    expect(
      currentCyclePhase(REGULAR_28_DAY_HISTORY, '2026-08-27', { averagePeriodLengthDays: 7 })
    ).toEqual({ cycleDayNumber: 7, phase: 'menstrual' });
  });

  it('an irregular cycle uses that specific historical gap\'s own real length, not a global average', () => {
    // 01-01 -> 01-25 is a real, fully-known 24-day cycle. Day 20 of it
    // (01-20) should already be past that short cycle's own ovulation
    // window (24-14-5=5 through 24-14+1=11), landing in luteal — using
    // the 28-day global default here would have wrongly placed it in the
    // ovulation window instead.
    const irregular = ['2026-01-01', '2026-01-25', '2026-03-10'];
    expect(currentCyclePhase(irregular, '2026-01-20')).toEqual({
      cycleDayNumber: 20,
      phase: 'luteal',
    });
  });
});

describe('cyclePhaseSegments', () => {
  it('is null with no logged history at all', () => {
    expect(cyclePhaseSegments([])).toBeNull();
  });

  it('splits a real 28-day cycle into the 4 phases, summing to the full cycle length', () => {
    const segments = cyclePhaseSegments(REGULAR_28_DAY_HISTORY);
    expect(segments).toEqual({
      cycleLengthDays: 28,
      menstrualDays: 5,
      follicularDays: 4,
      ovulationDays: 7,
      lutealDays: 12,
    });
    expect(
      segments.menstrualDays + segments.follicularDays + segments.ovulationDays + segments.lutealDays
    ).toBe(segments.cycleLengthDays);
  });

  it('a real, logged average period length changes the menstrual segment and follicular absorbs the difference', () => {
    const segments = cyclePhaseSegments(REGULAR_28_DAY_HISTORY, { averagePeriodLengthDays: 8 });
    expect(segments.menstrualDays).toBe(8);
    expect(segments.ovulationDays).toBe(7);
    expect(segments.lutealDays).toBe(12);
    expect(segments.follicularDays).toBe(1);
  });

  it('clamps follicular to 0 for a cycle too short to fit every phase, rather than going negative', () => {
    const segments = cyclePhaseSegments(['2026-08-01'], { defaultCycleLengthDays: 15, averagePeriodLengthDays: 5 });
    expect(segments.cycleLengthDays).toBe(15);
    expect(segments.follicularDays).toBe(0);
    expect(segments.menstrualDays).toBe(5);
  });

  it('falls back to the default cycle/period length off a single logged period', () => {
    const segments = cyclePhaseSegments(['2026-08-01']);
    expect(segments.cycleLengthDays).toBe(28);
    expect(segments.menstrualDays).toBe(5);
  });
});
