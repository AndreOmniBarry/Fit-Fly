// American Heart Association blood pressure category thresholds — a
// real, standardized, published table, not an invented scale. Purely
// informational: it says what range a reading falls in, never a
// diagnosis (see the app's "Not medical advice" framing app-wide).
//
// The table (systolic/diastolic, mmHg):
//   Normal:                <120  and  <80
//   Elevated:               120-129  and  <80
//   Hypertension Stage 1:   130-139  or  80-89
//   Hypertension Stage 2:   >=140  or  >=90
//   Hypertensive Crisis:    >180  and/or  >120  (seek care)
// Checked most-severe-first with OR at each step, which correctly
// reproduces the "whichever number is worse wins" rule without needing
// separate systolic/diastolic lookups.
export type BpCategory =
  | 'normal'
  | 'elevated'
  | 'hypertension-stage-1'
  | 'hypertension-stage-2'
  | 'hypertensive-crisis';

export function categorizeBloodPressure(systolic: number, diastolic: number): BpCategory {
  if (systolic >= 180 || diastolic >= 120) return 'hypertensive-crisis';
  if (systolic >= 140 || diastolic >= 90) return 'hypertension-stage-2';
  if (systolic >= 130 || diastolic >= 80) return 'hypertension-stage-1';
  if (systolic >= 120 && diastolic < 80) return 'elevated';
  return 'normal';
}

const CATEGORY_LABEL: Record<BpCategory, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  'hypertension-stage-1': 'Hypertension Stage 1',
  'hypertension-stage-2': 'Hypertension Stage 2',
  'hypertensive-crisis': 'Hypertensive Crisis — seek care promptly',
};

export function describeBloodPressureCategory(category: BpCategory): string {
  return CATEGORY_LABEL[category] ?? '—';
}

/** True for any category this app flags visually as concerning (Stage 2
 *  and above) — Normal/Elevated/Stage 1 read as the app's own calm accent
 *  color instead. */
export function isConcerningBloodPressure(category: BpCategory): boolean {
  return category === 'hypertension-stage-2' || category === 'hypertensive-crisis';
}
