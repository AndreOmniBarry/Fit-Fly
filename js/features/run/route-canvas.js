// Draws the shape of a GPS route on a <canvas> — a lightweight route
// sketch, not a full basemap. That's a deliberate choice: a real slippy
// map needs a live tile-imagery service (an external dependency this
// on-device, offline-first app doesn't otherwise have) and a heavy
// mapping library to vendor. A normalized route outline needs neither
// and still shows the shape of where you went.

export function drawRoute(canvas, points, strokeColor) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (points.length < 2) return;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  // Guard against a degenerate (near-zero-movement) route dividing by ~0.
  const latRange = Math.max(maxLat - minLat, 1e-6);
  const lonRange = Math.max(maxLon - minLon, 1e-6);
  const padding = 16;

  function project(point) {
    const x = padding + ((point.lon - minLon) / lonRange) * (width - padding * 2);
    // Latitude increases northward; canvas y increases downward — flip it.
    const y = padding + (1 - (point.lat - minLat) / latRange) * (height - padding * 2);
    return { x, y };
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((point, i) => {
    const { x, y } = project(point);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
