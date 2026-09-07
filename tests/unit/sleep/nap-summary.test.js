import { describe, expect, it } from 'vitest';
import { describeNapsForDate, totalNapMinutes } from '../../../js/features/sleep/nap-summary.js';

function nap(durationMinutes) {
  return { durationMinutes };
}

describe('totalNapMinutes', () => {
  it('is 0 for no naps, never null', () => {
    expect(totalNapMinutes([])).toBe(0);
  });

  it('sums multiple naps', () => {
    expect(totalNapMinutes([nap(20), nap(30)])).toBe(50);
  });
});

describe('describeNapsForDate', () => {
  it('is null when nothing was napped — absent, not a fabricated zero sentence', () => {
    expect(describeNapsForDate([])).toBeNull();
  });

  it('describes a single nap by its real duration', () => {
    expect(describeNapsForDate([nap(25)])).toBe('Also napped for 25m that day.');
  });

  it('describes multiple naps with a real count and total', () => {
    expect(describeNapsForDate([nap(20), nap(40)])).toBe('Also napped 2 times that day, 1h total.');
  });

  it('never says "today" — the same summary is reused for any viewed date via History', () => {
    expect(describeNapsForDate([nap(20)])).not.toMatch(/today/i);
  });
});
