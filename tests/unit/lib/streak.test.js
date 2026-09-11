import { describe, expect, it } from 'vitest';
import { calculateStreak } from '../../../js/lib/streak.js';

describe('calculateStreak', () => {
  it('is 0 with nothing logged', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('is 1 with a single day logged', () => {
    expect(calculateStreak(['2026-03-15'])).toBe(1);
  });

  it('counts consecutive days ending at the most recent', () => {
    expect(calculateStreak(['2026-03-13', '2026-03-14', '2026-03-15'])).toBe(3);
  });

  it('breaks on any gap, only counting the run up to the most recent day', () => {
    expect(calculateStreak(['2026-03-10', '2026-03-14', '2026-03-15'])).toBe(2);
  });

  it('collapses duplicate dates into one streak day', () => {
    expect(calculateStreak(['2026-03-15', '2026-03-15', '2026-03-14'])).toBe(2);
  });

  it('is order-independent — the same result regardless of input order', () => {
    const forward = calculateStreak(['2026-03-13', '2026-03-14', '2026-03-15']);
    const shuffled = calculateStreak(['2026-03-15', '2026-03-13', '2026-03-14']);
    expect(shuffled).toBe(forward);
  });

  // The walk counts backward from the most recent date, so in every case
  // below the "7 real days that earn a grace" are the 7 days closest to
  // the most recent one — the gap being forgiven sits *behind* them, not
  // ahead.
  describe('grace day — one real missed day per rolling week, never more', () => {
    it('forgives a single missed day once a real 7-day run has accrued', () => {
      // The 7 most recent days (03-04..03-10) are real and consecutive;
      // 03-03 is skipped; 03-01/03-02 are real again. All 9 real logged
      // days count — the missed 03-03 doesn't reset anything.
      const dates = [
        '2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05',
        '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
      ];
      expect(calculateStreak(dates)).toBe(9);
    });

    it('never forgives before a real 7-day run has accrued', () => {
      // Only 2 real days (03-05, 03-06) sit before the gap to 03-03 — too
      // early for a grace, so the walk stops there.
      const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06'];
      expect(calculateStreak(dates)).toBe(2);
    });

    it('a gap larger than one day is never forgiven, but the real run before it still counts', () => {
      // 7 real consecutive days (03-04..03-10), then a 3-day gap back to
      // 03-01 — too large to forgive, so the walk stops there, but the 7
      // real days already counted aren't lost either.
      const dates = [
        '2026-03-01', '2026-03-04', '2026-03-05', '2026-03-06',
        '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
      ];
      expect(calculateStreak(dates)).toBe(7);
    });

    it('a large gap is never forgiven regardless of how much real streak preceded it', () => {
      const dates = [
        '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07',
        '2026-03-08', '2026-03-09', '2026-03-10',
        '2026-02-19', // a 13-day gap, well behind the real 7-day run
      ];
      expect(calculateStreak(dates)).toBe(7);
    });

    it('only forgives one gap per rolling week — a second gap too soon after the first still stops the walk there', () => {
      // 7 real days (03-10..03-16), a forgiven gap back to 03-08, then
      // only 2 more real days (03-06, 03-07) before a second gap — too
      // soon since the last grace (2 real days, not 7), so the walk stops
      // there. Everything counted up to that point still stands.
      const dates = [
        '2026-03-04', '2026-03-06', '2026-03-07', '2026-03-08',
        '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13',
        '2026-03-14', '2026-03-15', '2026-03-16',
      ];
      expect(calculateStreak(dates)).toBe(10);
    });

    it('a real full week since the last grace earns a second one', () => {
      const dates = [
        '2026-02-27', // grace #2 target — 2 days before 03-01
        '2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04',
        '2026-03-05', '2026-03-06', '2026-03-07', // 7 real days since grace #1
        '2026-03-08', // grace #1 target — 2 days before 03-10
        '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13',
        '2026-03-14', '2026-03-15', '2026-03-16', // 7 most recent real days
      ];
      expect(calculateStreak(dates)).toBe(16);
    });
  });
});
