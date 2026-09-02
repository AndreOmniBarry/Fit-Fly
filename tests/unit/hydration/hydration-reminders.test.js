import { describe, expect, it } from 'vitest';
import { hydrationNeedsReminder } from '../../../js/features/hydration/hydration-reminders.js';

const HOUR_MS = 60 * 60 * 1000;

describe('hydrationNeedsReminder', () => {
  it('needs a reminder when there has never been one', () => {
    expect(hydrationNeedsReminder(null, Date.now(), 2 * HOUR_MS)).toBe(true);
  });

  it('does not need a reminder when the interval has not passed yet', () => {
    const now = Date.parse('2026-03-15T14:00:00Z');
    const lastReminder = new Date(now - HOUR_MS).toISOString(); // 1h ago, interval is 2h
    expect(hydrationNeedsReminder(lastReminder, now, 2 * HOUR_MS)).toBe(false);
  });

  it('needs a reminder once the interval has fully passed', () => {
    const now = Date.parse('2026-03-15T14:00:00Z');
    const lastReminder = new Date(now - 3 * HOUR_MS).toISOString(); // 3h ago, interval is 2h
    expect(hydrationNeedsReminder(lastReminder, now, 2 * HOUR_MS)).toBe(true);
  });

  it('needs a reminder exactly at the interval boundary', () => {
    const now = Date.parse('2026-03-15T14:00:00Z');
    const lastReminder = new Date(now - 2 * HOUR_MS).toISOString();
    expect(hydrationNeedsReminder(lastReminder, now, 2 * HOUR_MS)).toBe(true);
  });

  it('treats an unparseable timestamp as never having reminded', () => {
    expect(hydrationNeedsReminder('not-a-real-date', Date.now(), 2 * HOUR_MS)).toBe(true);
  });
});
