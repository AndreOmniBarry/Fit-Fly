import { describe, expect, it } from 'vitest';
import {
  calculateAcuteChronicWorkloadRatio,
  dailyTrainingLoadsFromSessions,
  sessionTrainingLoad,
} from '../../../js/features/programs/training-load.js';

describe('sessionTrainingLoad', () => {
  it('returns null with no session-RPE recorded — never a fabricated default', () => {
    const sets = [{ completedAt: '2026-03-01T09:00:00' }, { completedAt: '2026-03-01T09:40:00' }];
    expect(sessionTrainingLoad({ sessionRpe: null }, sets)).toBeNull();
    expect(sessionTrainingLoad({}, sets)).toBeNull();
  });

  it('returns null with no sets at all', () => {
    expect(sessionTrainingLoad({ sessionRpe: 7 }, [])).toBeNull();
  });

  it('returns null with only a single set — no real elapsed time to measure a duration from', () => {
    expect(sessionTrainingLoad({ sessionRpe: 7 }, [{ completedAt: '2026-03-01T09:00:00' }])).toBeNull();
  });

  it('returns null when every set shares the exact same timestamp — a real elapsed duration of zero, never treated as a real load of 0', () => {
    const sets = [
      { completedAt: '2026-03-01T09:00:00' },
      { completedAt: '2026-03-01T09:00:00' },
      { completedAt: '2026-03-01T09:00:00' },
    ];
    expect(sessionTrainingLoad({ sessionRpe: 7 }, sets)).toBeNull();
  });

  it('computes RPE x real duration in minutes from the first and last set', () => {
    const sets = [{ completedAt: '2026-03-01T09:00:00' }, { completedAt: '2026-03-01T09:40:00' }];
    // 40 real minutes between first and last set, RPE 7 -> 280 AU.
    expect(sessionTrainingLoad({ sessionRpe: 7 }, sets)).toBe(280);
  });

  it('uses only the first and last set, regardless of how many sets in between or their order in the array', () => {
    const sets = [
      { completedAt: '2026-03-01T09:20:00' }, // out of order on purpose
      { completedAt: '2026-03-01T09:00:00' },
      { completedAt: '2026-03-01T09:55:00' },
      { completedAt: '2026-03-01T09:40:00' },
    ];
    // Real span is still 09:00 -> 09:55 = 55 minutes, not the sum of gaps
    // between consecutive sets and not affected by array order.
    expect(sessionTrainingLoad({ sessionRpe: 6 }, sets)).toBe(330);
  });

  it('rounds to the nearest whole arbitrary unit (AU) — Foster\'s own method reports a whole-number load', () => {
    const sets = [{ completedAt: '2026-03-01T09:00:00' }, { completedAt: '2026-03-01T09:03:00' }];
    // RPE 5 x 3 real minutes = 15 AU exactly, no rounding drift to check
    // separately from a non-round case.
    expect(sessionTrainingLoad({ sessionRpe: 5 }, sets)).toBe(15);
    const oddSets = [{ completedAt: '2026-03-01T09:00:00' }, { completedAt: '2026-03-01T09:01:00' }];
    // RPE 6.5 (Borg CR10 allows half-point ratings) x 1 minute = 6.5 -> rounds to 7.
    expect(sessionTrainingLoad({ sessionRpe: 6.5 }, oddSets)).toBe(7);
  });
});

describe('dailyTrainingLoadsFromSessions', () => {
  it('sums two real sessions on the same local calendar day into one entry', () => {
    const result = dailyTrainingLoadsFromSessions([
      {
        session: { startedAt: '2026-03-01T07:00:00', sessionRpe: 5 },
        sets: [{ completedAt: '2026-03-01T07:00:00' }, { completedAt: '2026-03-01T07:30:00' }], // 150 AU
      },
      {
        session: { startedAt: '2026-03-01T18:00:00', sessionRpe: 3 },
        sets: [{ completedAt: '2026-03-01T18:00:00' }, { completedAt: '2026-03-01T18:20:00' }], // 60 AU
      },
    ]);
    expect(result).toEqual([{ date: '2026-03-01', load: 210 }]);
  });

  it('skips a session whose own load can\'t be computed (no RPE, or fewer than 2 sets) rather than inventing 0', () => {
    const result = dailyTrainingLoadsFromSessions([
      { session: { startedAt: '2026-03-01T07:00:00', sessionRpe: null }, sets: [{ completedAt: '2026-03-01T07:00:00' }, { completedAt: '2026-03-01T07:30:00' }] },
      { session: { startedAt: '2026-03-02T07:00:00', sessionRpe: 5 }, sets: [{ completedAt: '2026-03-02T07:00:00' }] },
      {
        session: { startedAt: '2026-03-03T07:00:00', sessionRpe: 4 },
        sets: [{ completedAt: '2026-03-03T07:00:00' }, { completedAt: '2026-03-03T07:10:00' }], // 40 AU — the only real one
      },
    ]);
    expect(result).toEqual([{ date: '2026-03-03', load: 40 }]);
  });

  it('groups by local calendar date, not a UTC slice', () => {
    // Same "local getFullYear/Month/Date, never .toISOString().slice()"
    // rule program-calendar.js's own localDateFromIso test already
    // covers — a local-midnight ISO string with no explicit offset reads
    // as local time here too.
    const result = dailyTrainingLoadsFromSessions([
      {
        session: { startedAt: '2026-03-15T00:00:00', sessionRpe: 5 },
        sets: [{ completedAt: '2026-03-15T00:00:00' }, { completedAt: '2026-03-15T00:30:00' }],
      },
    ]);
    expect(result).toEqual([{ date: '2026-03-15', load: 150 }]);
  });
});

describe('calculateAcuteChronicWorkloadRatio: sparse-history honesty', () => {
  it('returns every field null with no history at all', () => {
    const result = calculateAcuteChronicWorkloadRatio([], '2026-03-28');
    expect(result).toEqual({ acute: null, chronic: null, ratio: null, category: null, daysOfHistory: 0 });
  });

  it('refuses to compute a ratio from fewer than a real week of history', () => {
    const dailyLoads = [
      { date: '2026-03-26', load: 100 },
      { date: '2026-03-27', load: 100 },
      { date: '2026-03-28', load: 100 },
    ];
    const result = calculateAcuteChronicWorkloadRatio(dailyLoads, '2026-03-28');
    expect(result.acute).toBeNull();
    expect(result.chronic).toBeNull();
    expect(result.ratio).toBeNull();
    expect(result.category).toBeNull();
    expect(result.daysOfHistory).toBe(3); // still honestly reported, just not enough to rate
  });

  it('a real 7-day-old history is exactly enough — real 3-day-history-turned-7 boundary', () => {
    const dailyLoads = Array.from({ length: 7 }, (_, i) => ({
      date: dateOffset('2026-03-28', -(6 - i)),
      load: 100,
    }));
    const result = calculateAcuteChronicWorkloadRatio(dailyLoads, '2026-03-28');
    expect(result.daysOfHistory).toBe(7);
    expect(result.acute).toBe(100);
    expect(result.chronic).toBe(100); // chronic window can't extend past real history either
    expect(result.ratio).toBe(1);
    expect(result.category).toBe('sweet-spot');
  });

  it('never dilutes the chronic average with invented zero-load days before real history began', () => {
    // Only 10 real days of history — a naive /28 chronic average would
    // wrongly read this as a huge negative spike from "18 rest days".
    const dailyLoads = Array.from({ length: 10 }, (_, i) => ({
      date: dateOffset('2026-03-28', -(9 - i)),
      load: 50,
    }));
    const result = calculateAcuteChronicWorkloadRatio(dailyLoads, '2026-03-28');
    expect(result.daysOfHistory).toBe(10);
    expect(result.acute).toBe(50);
    expect(result.chronic).toBe(50); // averaged over the real 10 days, not 28
    expect(result.ratio).toBe(1);
  });

  it('a real rest day with no entry still counts as a real 0 inside an otherwise-covered window', () => {
    // 7 real calendar days of history (day -6 through today), but only
    // half of them actually have a logged, RPE'd session.
    const dailyLoads = [
      { date: dateOffset('2026-03-28', -6), load: 70 },
      { date: dateOffset('2026-03-28', -3), load: 70 },
      { date: '2026-03-28', load: 70 },
    ];
    const result = calculateAcuteChronicWorkloadRatio(dailyLoads, '2026-03-28');
    expect(result.daysOfHistory).toBe(7);
    expect(result.acute).toBe(30); // 210 / 7 real calendar days, missing days = 0
  });

  it('ignores an entry dated after asOfDate', () => {
    const dailyLoads = [
      ...Array.from({ length: 7 }, (_, i) => ({ date: dateOffset('2026-03-28', -(6 - i)), load: 100 })),
      { date: '2026-03-29', load: 999 }, // tomorrow — must not count
    ];
    const result = calculateAcuteChronicWorkloadRatio(dailyLoads, '2026-03-28');
    expect(result.acute).toBe(100);
    expect(result.daysOfHistory).toBe(7);
  });

  it('returns a null ratio (not a divide-by-zero artifact) when chronic load is genuinely zero', () => {
    const dailyLoads = Array.from({ length: 10 }, (_, i) => ({ date: dateOffset('2026-03-28', -(9 - i)), load: 0 }));
    const result = calculateAcuteChronicWorkloadRatio(dailyLoads, '2026-03-28');
    expect(result.acute).toBe(0);
    expect(result.chronic).toBe(0);
    expect(result.ratio).toBeNull();
    expect(result.category).toBeNull();
  });
});

describe('calculateAcuteChronicWorkloadRatio: real 28-day chronic window + category boundaries', () => {
  // A full 28-day history: the first 21 days (the "chronic-only" portion)
  // at one constant load, the most recent 7 days (the acute window) at
  // another — engineered so both acute and chronic land on clean whole
  // AU numbers (chronic always == 100) and only the ratio moves, so each
  // test below isolates exactly one real cutoff from Gabbett TJ. "The
  // training-injury prevention paradox..." Br J Sports Med 2016;50(5):
  // 273-280 (0.8 and 1.3) and the same paper's own 1.5 "danger zone".
  function historyWithRatio({ first21Total, last7Constant }) {
    const days = [];
    for (let i = 27; i >= 7; i--) {
      days.push({ date: dateOffset('2026-03-28', -i), load: 0 });
    }
    // Distribute first21Total across the 21 chronic-only days as whole
    // numbers (order/spread doesn't matter — only the sum does).
    let remaining = first21Total;
    for (let i = 0; i < 21; i++) {
      const share = i === 20 ? remaining : Math.floor(first21Total / 21);
      days[i].load = share;
      remaining -= share;
    }
    for (let i = 6; i >= 0; i--) {
      days.push({ date: dateOffset('2026-03-28', -i), load: last7Constant });
    }
    return days;
  }

  it('ratio exactly 0.8 (the real lower "sweet spot" edge) is still sweet-spot, not building', () => {
    // first21 sum 2240 (avg ~106.67) + last7 @80 => chronic (2240+560)/28=100, acute=80, ratio=0.8.
    const result = calculateAcuteChronicWorkloadRatio(historyWithRatio({ first21Total: 2240, last7Constant: 80 }), '2026-03-28');
    expect(result.chronic).toBe(100);
    expect(result.acute).toBe(80);
    expect(result.ratio).toBe(0.8);
    expect(result.category).toBe('sweet-spot');
  });

  it('ratio just below 0.8 is building', () => {
    const result = calculateAcuteChronicWorkloadRatio(historyWithRatio({ first21Total: 2247, last7Constant: 79 }), '2026-03-28');
    expect(result.chronic).toBe(100);
    expect(result.acute).toBe(79);
    expect(result.ratio).toBe(0.79);
    expect(result.category).toBe('building');
  });

  it('ratio exactly 1.3 (the real upper "sweet spot" edge) is still sweet-spot, not high-risk', () => {
    const result = calculateAcuteChronicWorkloadRatio(historyWithRatio({ first21Total: 1890, last7Constant: 130 }), '2026-03-28');
    expect(result.chronic).toBe(100);
    expect(result.acute).toBe(130);
    expect(result.ratio).toBe(1.3);
    expect(result.category).toBe('sweet-spot');
  });

  it('ratio just above 1.3 is high-risk', () => {
    const result = calculateAcuteChronicWorkloadRatio(historyWithRatio({ first21Total: 1883, last7Constant: 131 }), '2026-03-28');
    expect(result.chronic).toBe(100);
    expect(result.acute).toBe(131);
    expect(result.ratio).toBe(1.31);
    expect(result.category).toBe('high-risk');
  });

  it('ratio at 1.5 (Gabbett 2016\'s own cited "danger zone" threshold) is high-risk', () => {
    const result = calculateAcuteChronicWorkloadRatio(historyWithRatio({ first21Total: 1750, last7Constant: 150 }), '2026-03-28');
    expect(result.chronic).toBe(100);
    expect(result.acute).toBe(150);
    expect(result.ratio).toBe(1.5);
    expect(result.category).toBe('high-risk');
  });
});

function dateOffset(dateKey, deltaDays) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
