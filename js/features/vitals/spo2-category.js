export function categorizeSpo2(percent) {
    if (percent <= 90)
        return 'seek-care';
    if (percent < 95)
        return 'low';
    return 'normal';
}
const CATEGORY_LABEL = {
    normal: 'Normal',
    low: 'Low',
    'seek-care': 'Low — seek care promptly',
};
export function describeSpo2Category(category) {
    return CATEGORY_LABEL[category] ?? '—';
}
export function isConcerningSpo2(category) {
    return category !== 'normal';
}
//# sourceMappingURL=spo2-category.js.map