// A small, shared bar-trend chart — real HTML/CSS bars (not SVG), so
// every bar is a genuine, natively-focusable, natively-tappable
// <button>: no custom hit-testing or hover-only tooltip to reinvent, and
// a screen reader gets the exact value from a real aria-label with no
// separate "table view" to keep in sync. Used by Steps/Hydration/Run for
// their own daily/per-session trend — one hue (the mini-app's own
// accent), one series, so there's no legend to build: the card's own
// heading already says what's plotted.
//
// Each point can be `highlighted` (a goal met, a personal best) — drawn
// at full accent strength against a dimmer step of the *same* hue for
// the rest, never a second color standing in for status.
function clearChildren(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
}
/** Renders straight into `container` (expected to be an otherwise-empty
 *  `<div class="trend-chart">`) — safe to call again on the same element
 *  any time the underlying data changes, same "just re-render" contract
 *  as every other mini-app screen here. */
export function renderTrendChart(container, options) {
    const { points, accentVar, referenceValue, emptyMessage } = options;
    clearChildren(container);
    container.classList.add('trend-chart');
    container.style.setProperty('--trend-chart-accent', `var(${accentVar})`);
    if (points.length < 2) {
        const empty = document.createElement('p');
        empty.className = 'muted center-text';
        empty.style.fontSize = 'var(--fs-sm)';
        empty.textContent = emptyMessage;
        container.append(empty);
        return;
    }
    const maxValue = Math.max(...points.map((p) => p.value), referenceValue ?? 0, 1);
    const bars = document.createElement('div');
    bars.className = 'trend-chart-bars';
    bars.setAttribute('role', 'group');
    if (referenceValue != null && referenceValue > 0) {
        const referenceLine = document.createElement('div');
        referenceLine.className = 'trend-chart-reference';
        referenceLine.style.bottom = `${(referenceValue / maxValue) * 100}%`;
        bars.append(referenceLine);
    }
    for (const point of points) {
        const bar = document.createElement('button');
        bar.type = 'button';
        bar.className = 'trend-chart-bar';
        bar.dataset.key = point.key;
        bar.setAttribute('aria-label', `${point.tooltipValue}, ${point.tooltipDetail}`);
        const fill = document.createElement('span');
        fill.className = 'trend-chart-bar-fill';
        if (point.highlighted)
            fill.classList.add('trend-chart-bar-fill--highlighted');
        // Height starts at 0 and is set on the next frame so the CSS
        // transition on trend-chart-bar-fill actually has something to
        // animate from — the same "grow in, don't just appear" language as
        // Sleep's score ring / Steps' goal ring.
        fill.style.height = '0%';
        bar.append(fill);
        const label = document.createElement('span');
        label.className = 'trend-chart-bar-label';
        label.textContent = point.axisLabel;
        bar.append(label);
        const tooltip = document.createElement('span');
        tooltip.className = 'trend-chart-tooltip';
        tooltip.hidden = true;
        const tooltipValue = document.createElement('strong');
        tooltipValue.textContent = point.tooltipValue;
        const tooltipDetail = document.createElement('span');
        tooltipDetail.textContent = point.tooltipDetail;
        tooltip.append(tooltipValue, tooltipDetail);
        bar.append(tooltip);
        // Show on click/tap, hover, or keyboard focus; hide on leave/blur —
        // deliberately *not* a click-to-toggle. A real tap dispatches
        // pointerenter (which shows it) immediately before its own click
        // event, so a toggle-on-click would see it already open and instantly
        // close it again — a real bug caught by testing this with an actual
        // click, not just eyeballing hover in a desktop browser.
        const showTooltip = () => {
            for (const other of bars.querySelectorAll('.trend-chart-tooltip'))
                other.hidden = true;
            tooltip.hidden = false;
        };
        const hideTooltip = () => {
            tooltip.hidden = true;
        };
        bar.addEventListener('click', showTooltip);
        bar.addEventListener('focus', showTooltip);
        bar.addEventListener('blur', hideTooltip);
        bar.addEventListener('pointerenter', showTooltip);
        bar.addEventListener('pointerleave', hideTooltip);
        bars.append(bar);
        requestAnimationFrame(() => {
            fill.style.height = `${Math.max(2, (point.value / maxValue) * 100)}%`;
        });
    }
    container.append(bars);
}
//# sourceMappingURL=trend-chart.js.map