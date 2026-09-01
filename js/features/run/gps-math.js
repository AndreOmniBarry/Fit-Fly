// GPS distance/pace math. Deliberately conservative about trusting raw
// device fixes — consumer GPS is noisy, and a single bad fix (accuracyM
// in the hundreds of meters, common near buildings/trees) can add a
// phantom couple hundred meters to a route's total distance if it's not
// filtered out first.

const EARTH_RADIUS_M = 6371000; // mean radius, WGS84-adjacent — fine for run-tracking precision

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two {lat, lon} points, in meters. */
export function haversineDistanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_M * c;
}

/** Sums consecutive-point distances along a route. */
export function totalRouteDistanceMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Drops fixes whose reported accuracy radius is worse than maxAccuracyM
 *  (default 30m — a reasonable outdoor GPS fix; outliers well past this
 *  are almost always a bad read, not real movement). A fix with no
 *  accuracy field at all is kept rather than guessed at. */
export function filterAccuratePoints(points, maxAccuracyM = 30) {
  return points.filter((p) => p.accuracyM == null || p.accuracyM <= maxAccuracyM);
}

/** Pace in seconds/km. null if there's no meaningful distance or time yet
 *  (e.g. the first couple of GPS fixes) — never a divide-by-zero Infinity
 *  leaking into the UI. */
export function calculatePaceSecPerKm(distanceMeters, durationMs) {
  if (!(distanceMeters > 0) || !(durationMs > 0)) return null;
  const km = distanceMeters / 1000;
  const seconds = durationMs / 1000;
  return seconds / km;
}

/** "M:SS /km", or an em dash while there's nothing to show yet. */
export function formatPace(secPerKm) {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
  const totalSeconds = Math.round(secPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

/** "1.2 km" / "850 m" — never more than one decimal place. */
export function formatDistance(meters) {
  if (!(meters > 0)) return '0 m';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

/** Pace over just the last `windowMs` of the route — "how fast am I going
 *  right now", distinct from calculatePaceSecPerKm's average over the
 *  whole run. This is what a real running watch's "current pace" reads,
 *  and it's what makes a live number actually useful mid-run: an average
 *  pace can't tell you you've sped up in the last minute, only the whole
 *  run so far. Built entirely from real recorded points — no smoothing
 *  beyond what filterAccuratePoints already did upstream, no fabricated
 *  precision. null with fewer than 2 points in the window (nothing to
 *  measure a pace across yet), same honesty contract as
 *  calculatePaceSecPerKm. */
export function recentPaceSecPerKm(points, windowMs = 30000) {
  if (points.length < 2) return null;
  const latestTMs = points[points.length - 1].tMs;
  const windowPoints = points.filter((p) => latestTMs - p.tMs <= windowMs);
  if (windowPoints.length < 2) return null;
  const distanceMeters = totalRouteDistanceMeters(windowPoints);
  const durationMs = windowPoints[windowPoints.length - 1].tMs - windowPoints[0].tMs;
  return calculatePaceSecPerKm(distanceMeters, durationMs);
}
