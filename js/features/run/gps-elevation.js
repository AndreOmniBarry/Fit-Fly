// Elevation gain/loss and "flights climbed" from real GPS altitude
// readings — the Geolocation API already reports position.coords.altitude
// / altitudeAccuracy alongside lat/lon on every fix (see run-tracker.js's
// own onPosition, and native-background-geo.js for the native
// background-geolocation path, whose Location type carries the same two
// fields); this module is what actually reads and uses them. Most phones/
// browsers report a null altitude in practice (no barometer exposed to
// the page, or a GPS-only vertical fix too poor to trust) — every
// function below is honest about that (see hasElevationData) rather than
// showing a fabricated flat line or a made-up "0m gain".

// A GPS vertical fix is typically several times noisier than its
// horizontal one — a stricter threshold than gps-math.js's own 30m
// horizontal filterAccuratePoints default, tuned to altitude's own worse
// real-world noise floor.
const DEFAULT_MAX_ALTITUDE_ACCURACY_M = 20;

// Small altitude wobble between consecutive fixes is GPS/barometer noise,
// not real ascent or descent — this is the same "minimum step before it
// counts" noise floor real elevation-gain algorithms (Strava's, Garmin's
// own smoothed gain) use, so summing raw deltas never inflates a flat
// route into a fake climb.
const MIN_ELEVATION_STEP_M = 1;

// The standard "~3m (10ft) per flight" convention Apple Health and Google
// Fit both use to convert a real measured elevation gain into a "flights
// climbed" count — a fixed, cited unit conversion applied to real data,
// not a measurement or estimate of its own.
const METERS_PER_FLIGHT = 3;

/** Drops fixes with no real altitude reading at all, or whose reported
 *  vertical accuracy is worse than maxAccuracyM. A fix with no accuracy
 *  field is kept rather than guessed at — same convention as
 *  gps-math.js's filterAccuratePoints. */
export function filterAccurateElevationPoints(points, maxAccuracyM = DEFAULT_MAX_ALTITUDE_ACCURACY_M) {
  return points.filter(
    (p) => p.altitudeM != null && (p.altitudeAccuracyM == null || p.altitudeAccuracyM <= maxAccuracyM)
  );
}

/** Whether this route has enough real altitude data to say anything at
 *  all about elevation — callers should hide the whole elevation section
 *  when this is false, never show a zero/flat placeholder in its place. */
export function hasElevationData(points) {
  return filterAccurateElevationPoints(points).length >= 2;
}

/** Real net climb, in meters — sums only consecutive-fix rises of at
 *  least MIN_ELEVATION_STEP_M, so GPS/barometer jitter on a flat route
 *  never sums into a fake gain. */
export function elevationGainMeters(points, minStepM = MIN_ELEVATION_STEP_M) {
  const accurate = filterAccurateElevationPoints(points);
  let gain = 0;
  for (let i = 1; i < accurate.length; i++) {
    const delta = accurate[i].altitudeM - accurate[i - 1].altitudeM;
    if (delta >= minStepM) gain += delta;
  }
  return gain;
}

/** The descent counterpart to elevationGainMeters — same noise floor. */
export function elevationLossMeters(points, minStepM = MIN_ELEVATION_STEP_M) {
  const accurate = filterAccurateElevationPoints(points);
  let loss = 0;
  for (let i = 1; i < accurate.length; i++) {
    const delta = accurate[i - 1].altitudeM - accurate[i].altitudeM;
    if (delta >= minStepM) loss += delta;
  }
  return loss;
}

/** A real elevation gain converted into Apple Health/Google Fit's own
 *  "flights climbed" unit — floor, not round, since a partial flight
 *  isn't a climbed one. */
export function estimateFlightsClimbed(gainMeters) {
  return Math.floor(gainMeters / METERS_PER_FLIGHT);
}

/** {minM, maxM} across the route's real accurate altitude readings — used
 *  only to scale the elevation-profile chart, never shown as a number of
 *  its own. null with no usable altitude data. */
export function elevationRangeMeters(points) {
  const accurate = filterAccurateElevationPoints(points);
  if (accurate.length === 0) return null;
  const altitudes = accurate.map((p) => p.altitudeM);
  return { minM: Math.min(...altitudes), maxM: Math.max(...altitudes) };
}
