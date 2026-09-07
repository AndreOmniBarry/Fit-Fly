// Draws a real elevation profile — real altitude readings plotted over
// real cumulative GPS distance — the vertical counterpart to
// route-canvas.js's flat route sketch. Same lightweight-sketch
// philosophy: no tile imagery or vendored charting library, just the real
// shape of the climb, filled and stroked in the mini-app's own accent.
import { haversineDistanceMeters } from './gps-math.js';
import { filterAccurateElevationPoints } from './gps-elevation.js';

export function drawElevationProfile(canvas, points, strokeColor, fillColor) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const accurate = filterAccurateElevationPoints(points);
  if (accurate.length < 2) return;

  let cumulative = 0;
  const distances = [0];
  for (let i = 1; i < accurate.length; i++) {
    cumulative += haversineDistanceMeters(accurate[i - 1], accurate[i]);
    distances.push(cumulative);
  }
  const altitudes = accurate.map((p) => p.altitudeM);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  // Guard against a perfectly flat profile dividing by zero.
  const altRange = Math.max(maxAlt - minAlt, 1);
  const totalDistance = Math.max(cumulative, 1);
  const padding = 8;

  function project(i) {
    const x = padding + (distances[i] / totalDistance) * (width - padding * 2);
    // Altitude increases upward; canvas y increases downward — flip it,
    // same as route-canvas.js's own lat/y flip.
    const y = height - padding - ((altitudes[i] - minAlt) / altRange) * (height - padding * 2);
    return { x, y };
  }

  // Filled area under the profile line, down to the baseline — reads
  // instantly as "elevation," the same shape every running app's own
  // elevation chart uses.
  ctx.beginPath();
  ctx.moveTo(project(0).x, height - padding);
  accurate.forEach((_, i) => ctx.lineTo(project(i).x, project(i).y));
  ctx.lineTo(project(accurate.length - 1).x, height - padding);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.beginPath();
  accurate.forEach((_, i) => {
    const { x, y } = project(i);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // The route's real highest point — a small marker, the "summit" of this
  // run's own real profile, not a fabricated landmark.
  const peakIndex = altitudes.indexOf(maxAlt);
  const peak = project(peakIndex);
  ctx.beginPath();
  ctx.arc(peak.x, peak.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
}
