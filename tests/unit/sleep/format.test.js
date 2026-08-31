import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDurationHM, formatTimeInputValue } from '../../../js/features/sleep/format.js';

describe('formatDurationHM', () => {
  it('formats hours and minutes together', () => {
    expect(formatDurationHM(462)).toBe('7h 42m');
  });

  it('drops the minutes when there are none', () => {
    expect(formatDurationHM(480)).toBe('8h');
  });

  it('drops the hours when there are none', () => {
    expect(formatDurationHM(45)).toBe('45m');
  });

  it('never goes negative', () => {
    expect(formatDurationHM(-30)).toBe('0m');
  });
});

describe('formatClockTime', () => {
  it('formats a typical evening bedtime', () => {
    expect(formatClockTime('2024-01-01T23:14:00.000Z')).toBe('11:14p');
  });

  it('formats a typical morning wake time', () => {
    expect(formatClockTime('2024-01-02T06:56:00.000Z')).toBe('6:56a');
  });

  it('formats midnight as 12:00a', () => {
    expect(formatClockTime('2024-01-01T00:00:00.000Z')).toBe('12:00a');
  });

  it('formats noon as 12:00p', () => {
    expect(formatClockTime('2024-01-01T12:00:00.000Z')).toBe('12:00p');
  });

  it('pads single-digit minutes', () => {
    expect(formatClockTime('2024-01-01T09:05:00.000Z')).toBe('9:05a');
  });
});

describe('formatTimeInputValue', () => {
  it('produces a zero-padded 24-hour HH:MM', () => {
    expect(formatTimeInputValue('2024-01-01T23:14:00.000Z')).toBe('23:14');
    expect(formatTimeInputValue('2024-01-01T06:05:00.000Z')).toBe('06:05');
  });
});
