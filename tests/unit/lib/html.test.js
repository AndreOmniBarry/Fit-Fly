import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../../js/lib/html.js';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('escapes an ampersand exactly once, not double-encoded', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Chicken and rice, 300 kcal')).toBe('Chicken and rice, 300 kcal');
  });

  it('coerces non-string input rather than throwing', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
  });
});
