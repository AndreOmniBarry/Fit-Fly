export function categorizeBloodPressure(systolic, diastolic) {
    if (systolic >= 180 || diastolic >= 120)
        return 'hypertensive-crisis';
    if (systolic >= 140 || diastolic >= 90)
        return 'hypertension-stage-2';
    if (systolic >= 130 || diastolic >= 80)
        return 'hypertension-stage-1';
    if (systolic >= 120 && diastolic < 80)
        return 'elevated';
    return 'normal';
}
const CATEGORY_LABEL = {
    normal: 'Normal',
    elevated: 'Elevated',
    'hypertension-stage-1': 'Hypertension Stage 1',
    'hypertension-stage-2': 'Hypertension Stage 2',
    'hypertensive-crisis': 'Hypertensive Crisis — seek care promptly',
};
export function describeBloodPressureCategory(category) {
    return CATEGORY_LABEL[category] ?? '—';
}
/** True for any category this app flags visually as concerning (Stage 2
 *  and above) — Normal/Elevated/Stage 1 read as the app's own calm accent
 *  color instead. */
export function isConcerningBloodPressure(category) {
    return category === 'hypertension-stage-2' || category === 'hypertensive-crisis';
}
//# sourceMappingURL=blood-pressure-category.js.map