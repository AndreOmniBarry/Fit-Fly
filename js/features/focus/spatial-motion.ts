// The 3D trig behind "this isn't just stereo panning" — a slow orbit
// around the listener that a PannerNode (HRTF mode) is fed over time, so
// e.g. wind genuinely drifts around the head instead of sitting static in
// one spot. Pure math: no AudioParam, no AudioContext.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type OrbitPlane = 'xz' | 'xy' | 'yz';

export interface SpatialMotionProfile {
  enabled: boolean;
  /** Distance from the listener, in meters. */
  radius: number;
  /** Which plane the orbit travels in. */
  plane: OrbitPlane;
  /** Seconds for one full revolution. */
  periodSeconds: number;
  /** Fixed offset on the axis the orbit plane doesn't use. */
  offsetAxis?: number;
}

/** Position at time `tSeconds` along the profile's orbit — periodic (same
 *  result every `periodSeconds`), and a fixed point straight ahead when
 *  motion is disabled. */
export function positionAtTime(profile: SpatialMotionProfile, tSeconds: number): Vec3 {
  if (!profile.enabled || profile.periodSeconds <= 0) {
    return { x: 0, y: 0, z: -profile.radius };
  }

  const angle = (2 * Math.PI * tSeconds) / profile.periodSeconds;
  const a = Math.cos(angle) * profile.radius;
  const b = Math.sin(angle) * profile.radius;
  const offset = profile.offsetAxis ?? 0;

  switch (profile.plane) {
    case 'xz':
      return { x: a, y: offset, z: b };
    case 'xy':
      return { x: a, y: b, z: offset };
    case 'yz':
      return { x: offset, y: a, z: b };
  }
}
