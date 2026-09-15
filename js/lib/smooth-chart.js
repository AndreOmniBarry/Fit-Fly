/** Runs a smooth Catmull-Rom curve (tension 1/6) through every point in
 *  order — the curve passes through every real point exactly; only the
 *  tangent between consecutive points is smoothed. */
export function smoothPathThrough(points) {
    if (points.length === 0)
        return '';
    const first = points[0];
    if (points.length === 1)
        return `M${first.x},${first.y}`;
    let d = `M${first.x},${first.y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
}
/** Lays out a series of real values (in order) into an SVG-ready smooth
 *  line/area, scaled to fill `width`x`height` exactly. Never fabricates a
 *  point that doesn't exist in `values` — pass exactly the real values you
 *  have, in order. `floorValue` (default 0) is what "empty" scales to at
 *  the bottom — pass it explicitly when 0 isn't a meaningful floor for the
 *  series being drawn. */
export function buildSmoothAreaGeometry(values, { width = 320, height = 140, floorValue = 0 } = {}) {
    if (values.length === 0) {
        return { width, height, points: [], linePath: '', areaPath: '', maxValue: 0 };
    }
    const maxValue = Math.max(...values, floorValue, 1);
    const range = maxValue - floorValue || 1;
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const points = values.map((value, i) => ({
        x: values.length > 1 ? i * stepX : width / 2,
        y: height - ((value - floorValue) / range) * height,
    }));
    const linePath = smoothPathThrough(points);
    const last = points[points.length - 1];
    const areaPath = points.length > 1 ? `${linePath} L${last.x},${height} L${points[0].x},${height} Z` : '';
    return { width, height, points, linePath, areaPath, maxValue };
}
//# sourceMappingURL=smooth-chart.js.map