import { describe, expect, it } from 'vitest';
import { CATEGORIES, isValidCategory, isValidThemePreference } from '../../js/lib/theme.js';

describe('isValidCategory', () => {
  it('accepts every category the onboarding engine can assign', () => {
    for (const category of CATEGORIES) {
      expect(isValidCategory(category)).toBe(true);
    }
  });

  it('rejects unknown or empty values', () => {
    expect(isValidCategory('cardio-bro')).toBe(false);
    expect(isValidCategory('')).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });
});

describe('isValidThemePreference', () => {
  it('accepts light, dark, and system', () => {
    expect(isValidThemePreference('light')).toBe(true);
    expect(isValidThemePreference('dark')).toBe(true);
    expect(isValidThemePreference('system')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidThemePreference('auto')).toBe(false);
    expect(isValidThemePreference(null)).toBe(false);
  });
});
