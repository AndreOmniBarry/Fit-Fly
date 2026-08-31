// The 3D trig behind "this isn't just stereo panning" — a slow orbit
// around the listener that a PannerNode (HRTF mode) is fed over time, so
// e.g. wind genuinely drifts around the head instead of sitting static in
// one spot. Pure math: no AudioParam, no AudioContext.
/** Position at time `tSeconds` along the profile's orbit — periodic (same
 *  result every `periodSeconds`), and a fixed point straight ahead when
 *  motion is disabled. */
export function positionAtTime(profile, tSeconds) {
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
//# sourceMappingURL=spatial-motion.js.map