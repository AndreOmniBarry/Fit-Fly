import { describe, expect, it } from 'vitest';
import { categorizeSpo2, describeSpo2Category, isConcerningSpo2 } from '../../../js/features/vitals/spo2-category.js';

describe('categorizeSpo2', () => {
  it('is Normal at 95% and above', () => {
    expect(categorizeSpo2(95)).toBe('normal');
    expect(categorizeSpo2(99)).toBe('normal');
    expect(categorizeSpo2(100)).toBe('normal');
  });

  it('is Low between 91% and 94%', () => {
    expect(categorizeSpo2(94)).toBe('low');
    expect(categorizeSpo2(91)).toBe('low');
  });

  it('is Seek Care at 90% and below', () => {
    expect(categorizeSpo2(90)).toBe('seek-care');
    expect(categorizeSpo2(80)).toBe('seek-care');
  });
});

describe('describeSpo2Category', () => {
  it('describes every category with real, non-empty text', () => {
    for (const category of ['normal', 'low', 'seek-care']) {
      expect(describeSpo2Category(category).length).toBeGreaterThan(0);
    }
  });
});

describe('isConcerningSpo2', () => {
  it('flags anything below Normal as concerning', () => {
    expect(isConcerningSpo2('normal')).toBe(false);
    expect(isConcerningSpo2('low')).toBe(true);
    expect(isConcerningSpo2('seek-care')).toBe(true);
  });
});
