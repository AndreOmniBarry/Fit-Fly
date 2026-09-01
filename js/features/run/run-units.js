// A distance-unit preference (km/mi), persisted per-device the same way
// theme is — and unit-aware formatters that convert real meters/pace-per-
// km into the chosen unit. gps-math.js's own formatDistance/formatPace
// stay metric-only and untouched (they're already tested and used
// elsewhere); this is a thin conversion layer on top, not a fork of them.
import { getPref, setPref } from '../../lib/storage.js';
import { formatDistance as formatDistanceMetric, formatPace as formatPaceMetric } from './gps-math.js';

const METERS_PER_MILE = 1609.344;
const PREF_KEY = 'distanceUnit';

/** @returns {'km'|'mi'} */
export function getDistanceUnit() {
  return getPref(PREF_KEY, 'km') === 'mi' ? 'mi' : 'km';
}

export function setDistanceUnit(unit) {
  setPref(PREF_KEY, unit === 'mi' ? 'mi' : 'km');
}

/** "3.11 mi" / "1.2 km" / "850 m" depending on unit and magnitude. */
export function formatDistanceForUnit(meters, unit) {
  if (unit !== 'mi') return formatDistanceMetric(meters);
  if (!(meters > 0)) return '0 mi';
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

/** "M:SS /mi" / "M:SS /km", converting the underlying sec/km the same way
 *  a mile is longer than a km — never re-deriving pace from scratch. */
export function formatPaceForUnit(secPerKm, unit) {
  if (unit !== 'mi') return formatPaceMetric(secPerKm);
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
  const secPerMile = secPerKm * (METERS_PER_MILE / 1000);
  const totalSeconds = Math.round(secPerMile);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /mi`;
}

/** The split boundary in meters for the given unit — 1km or 1mi. */
export function splitBoundaryMetersForUnit(unit) {
  return unit === 'mi' ? METERS_PER_MILE : 1000;
}
