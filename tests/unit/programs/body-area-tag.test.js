import { describe, expect, it } from 'vitest';
import { tagBodyArea } from '../../../js/features/programs/body-area-tag.js';

describe('tagBodyArea', () => {
  it.each([
    ['right knee', 'knee'],
    ['Knee', 'knee'],
    ['lower back', 'lower-back'],
    ['my low back has been sore', 'lower-back'],
    ['left shoulder', 'shoulder'],
    ['rotator cuff', 'shoulder'],
    ['wrist', 'wrist'],
    ['hip flexor', 'hip'],
    ['groin', 'hip'],
    ['ankle sprain', 'ankle'],
    ['achilles', 'ankle'],
    ['neck', 'neck'],
  ])('maps "%s" -> %s', (input, expected) => {
    expect(tagBodyArea(input)).toBe(expected);
  });

  it('falls through to "other" instead of guessing on unrecognized text', () => {
    expect(tagBodyArea('my elbow')).toBe('other');
    expect(tagBodyArea('general fatigue')).toBe('other');
  });

  it('handles empty/missing input without throwing', () => {
    expect(tagBodyArea('')).toBe('other');
    expect(tagBodyArea(undefined)).toBe('other');
    expect(tagBodyArea(null)).toBe('other');
  });
});
