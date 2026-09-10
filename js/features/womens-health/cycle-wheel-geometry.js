// Pure arc/segment math for the circular cycle-phase wheel — real phase
// segments (their true share of the actual cycle length, from
// cyclePhaseSegments in cycle-prediction.js — never four equal quarters)
// laid out clockwise around a ring instead of along the flat phase bar
// this replaces, with a marker for today's real position in it. Deliberately
// DOM-free (cycle-log-view.js is the only thing that touches the document
// or builds real SVG elements from this) — every angle and path string
// here is directly assertable in a unit test, same "pure logic lives
// outside the view" convention as sleep-insight-chart.ts and friends.
//
// Convention: fraction 0 sits at 12 o'clock, increasing clockwise — the
// same "day 1 at the top, moving clockwise" a real wall calendar or any
// reference circular cycle tracker uses.

/**
 * @param {{cx: number, cy: number}} center
 * @param {number} radius
 * @param {number} fraction 0-1 around the circle, clockwise from 12 o'clock
 */
export function polarPoint(center, radius, fraction) {
  const angle = fraction * Math.PI * 2;
  return {
    x: center.cx + radius * Math.sin(angle),
    y: center.cy - radius * Math.cos(angle),
  };
}

/** An SVG path `d` for one donut-style wedge (an annulus segment) running
 *  clockwise from startFraction to endFraction — the actual shape each
 *  phase segment is drawn as. A full-circle segment (fraction span of 1)
 *  is split into two half-sweeps, since a single SVG arc command can't
 *  describe a complete circle on its own. */
export function donutSegmentPath(center, outerRadius, innerRadius, startFraction, endFraction) {
  const span = endFraction - startFraction;
  if (span >= 1) {
    const mid = startFraction + 0.5;
    return `${donutSegmentPath(center, outerRadius, innerRadius, startFraction, mid)} ${donutSegmentPath(center, outerRadius, innerRadius, mid, endFraction)}`;
  }

  const outerStart = polarPoint(center, outerRadius, startFraction);
  const outerEnd = polarPoint(center, outerRadius, endFraction);
  const innerEnd = polarPoint(center, innerRadius, endFraction);
  const innerStart = polarPoint(center, innerRadius, startFraction);
  const largeArc = span > 0.5 ? 1 : 0;

  return [
    `M${outerStart.x},${outerStart.y}`,
    `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${outerEnd.x},${outerEnd.y}`,
    `L${innerEnd.x},${innerEnd.y}`,
    `A${innerRadius},${innerRadius} 0 ${largeArc} 0 ${innerStart.x},${innerStart.y}`,
    'Z',
  ].join(' ');
}

/**
 * @param {[string, number][]} orderedSegments [phaseName, dayCount] pairs,
 *   the same shape renderPhaseBar's own orderedSegments array already is
 *   — real day counts, in real phase order, never a fabricated split.
 * @returns {{phase: string, days: number, d: string, startFraction: number, endFraction: number}[]}
 *   Segments with 0 real days are skipped entirely, same as the flat bar.
 */
export function buildCycleWheelSegments(orderedSegments, { center, outerRadius, innerRadius }) {
  const totalDays = orderedSegments.reduce((sum, [, days]) => sum + days, 0);
  if (totalDays <= 0) return [];

  const result = [];
  let cursor = 0;
  for (const [phase, days] of orderedSegments) {
    if (days <= 0) continue;
    const startFraction = cursor;
    const endFraction = cursor + days / totalDays;
    result.push({
      phase,
      days,
      startFraction,
      endFraction,
      d: donutSegmentPath(center, outerRadius, innerRadius, startFraction, endFraction),
    });
    cursor = endFraction;
  }
  return result;
}

/** Where the "today" marker sits — the midline radius between the inner
 *  and outer ring, at cycleDayNumber's own real fraction around it (day 1
 *  sits at the very top, not a full day-width clockwise from it — the
 *  same "day 1 starts the ring" convention every segment above uses). */
export function markerPosition(cycleDayNumber, cycleLengthDays, { center, outerRadius, innerRadius }) {
  const fraction = cycleLengthDays > 0 ? ((cycleDayNumber - 1) / cycleLengthDays) % 1 : 0;
  const midRadius = (outerRadius + innerRadius) / 2;
  return { ...polarPoint(center, midRadius, fraction), fraction };
}
