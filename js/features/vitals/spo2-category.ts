// Commonly published pulse-oximetry reference ranges (e.g. American Lung
// Association, Mayo Clinic patient-education material) — real, widely
// cited thresholds, not an invented scale. Purely informational, the
// same "a range, never a diagnosis" contract as blood-pressure-category.ts.
export type Spo2Category = 'normal' | 'low' | 'seek-care';

export function categorizeSpo2(percent: number): Spo2Category {
  if (percent <= 90) return 'seek-care';
  if (percent < 95) return 'low';
  return 'normal';
}

const CATEGORY_LABEL: Record<Spo2Category, string> = {
  normal: 'Normal',
  low: 'Low',
  'seek-care': 'Low — seek care promptly',
};

export function describeSpo2Category(category: Spo2Category): string {
  return CATEGORY_LABEL[category] ?? '—';
}

export function isConcerningSpo2(category: Spo2Category): boolean {
  return category !== 'normal';
}
