export function categorizeBodyTemperature(celsius) {
    if (celsius < 35.0)
        return 'hypothermia-risk';
    if (celsius < 36.1)
        return 'low';
    if (celsius <= 37.2)
        return 'normal';
    if (celsius < 38.0)
        return 'elevated';
    if (celsius < 39.4)
        return 'fever';
    return 'high-fever';
}
const CATEGORY_LABEL = {
    'hypothermia-risk': 'Hypothermia risk — seek care promptly',
    low: 'Low',
    normal: 'Normal',
    elevated: 'Elevated',
    fever: 'Fever',
    'high-fever': 'High fever — seek care promptly',
};
export function describeBodyTemperatureCategory(category) {
    return CATEGORY_LABEL[category] ?? '—';
}
/** True for either extreme this app flags visually as concerning
 *  (hypothermia risk and high fever, both real "call your doctor"
 *  thresholds above) — Low/Normal/Elevated/Fever read as the app's own
 *  calm accent color instead, the same "only the real emergency
 *  thresholds get the alarm color" contract as blood-pressure-category.ts. */
export function isConcerningBodyTemperature(category) {
    return category === 'hypothermia-risk' || category === 'high-fever';
}
//# sourceMappingURL=body-temperature-category.js.map