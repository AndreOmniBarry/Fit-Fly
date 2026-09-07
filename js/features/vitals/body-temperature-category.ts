// Real, widely published adult body-temperature reference ranges — Mayo
// Clinic patient-education material — not an invented scale. Purely
// informational: it says what range a reading falls in, never a
// diagnosis (see the app's "Not medical advice" framing app-wide), the
// same contract as blood-pressure-category.ts/spo2-category.ts.
//
// The table (Celsius, converted from Mayo Clinic's published Fahrenheit
// figures — https://www.mayoclinic.org/first-aid/first-aid-fever/basics/art-20056685
// and https://my.clevelandclinic.org/health/diseases/21164-hypothermia-low-body-temperature):
//   Hypothermia risk:  <35.0°C (<95°F) — Mayo Clinic's hypothermia threshold
//   Low:               35.0–36.0°C (95–96.8°F) — below Mayo's normal range but not yet hypothermic
//   Normal:            36.1–37.2°C (97–99°F) — Mayo Clinic's normal range
//   Elevated:          37.3–37.9°C (99.1–100.3°F) — above normal but below the fever threshold
//   Fever:             38.0–39.3°C (100.4–103°F) — Mayo Clinic/CDC's fever threshold (100.4°F/38°C)
//   High fever:        >=39.4°C (>=103°F) — Mayo Clinic's "call your doctor" threshold
// Checked coldest/hottest-extreme-first so a single out-of-range reading
// can't fall through to the wrong bucket.
export type BodyTemperatureCategory = 'hypothermia-risk' | 'low' | 'normal' | 'elevated' | 'fever' | 'high-fever';

export function categorizeBodyTemperature(celsius: number): BodyTemperatureCategory {
  if (celsius < 35.0) return 'hypothermia-risk';
  if (celsius < 36.1) return 'low';
  if (celsius <= 37.2) return 'normal';
  if (celsius < 38.0) return 'elevated';
  if (celsius < 39.4) return 'fever';
  return 'high-fever';
}

const CATEGORY_LABEL: Record<BodyTemperatureCategory, string> = {
  'hypothermia-risk': 'Hypothermia risk — seek care promptly',
  low: 'Low',
  normal: 'Normal',
  elevated: 'Elevated',
  fever: 'Fever',
  'high-fever': 'High fever — seek care promptly',
};

export function describeBodyTemperatureCategory(category: BodyTemperatureCategory): string {
  return CATEGORY_LABEL[category] ?? '—';
}

/** True for either extreme this app flags visually as concerning
 *  (hypothermia risk and high fever, both real "call your doctor"
 *  thresholds above) — Low/Normal/Elevated/Fever read as the app's own
 *  calm accent color instead, the same "only the real emergency
 *  thresholds get the alarm color" contract as blood-pressure-category.ts. */
export function isConcerningBodyTemperature(category: BodyTemperatureCategory): boolean {
  return category === 'hypothermia-risk' || category === 'high-fever';
}
