// A tiny, dependency-free spatial-tilt engine. Reads pointer movement
// (desktop/mouse) or real device-orientation tilt (phone, once granted)
// and exposes it as CSS custom properties on the root element, so any
// surface underneath can react to it in pure CSS — cards rotate a few
// degrees in 3D space and their depth-layered children visually separate,
// the way things actually do when they sit at different distances from a
// light source instead of being flat rectangles stacked on a page.
//
// One rAF loop lerps toward the latest reading every frame, which *is*
// the spring — there's deliberately no CSS `transition` on the transform
// itself (that would fight the 60fps updates and read as laggy); the only
// CSS transition that belongs on a tilt-driven element is for a discrete
// state change like a press, on a value this module doesn't touch.
//
// Fully inert under prefers-reduced-motion (the whole point of "spatial"
// here is a subtle depth cue, not motion for its own sake) and safe
// everywhere: every input is feature-detected and best-effort.
//
// The rAF loop only actually runs while `root` is on screen — router.js
// shows/hides top-level screens via the `hidden` attribute, so a
// MutationObserver on that attribute is enough to know. There's no point
// spending a frame budget animating something no one can see, and leaving
// it running unconditionally forever is worse than idle: navigate away
// and it just keeps ticking in the background for the rest of the
// session.
//
// It also stops itself the moment the lerp has actually converged (no
// real input is changing the target, so there's nothing left to animate
// toward) rather than re-requesting a frame forever once settled — a new
// pointer/orientation reading restarts it. Same idle-when-nothing's-
// -moving discipline as the visibility gate above, just for "on screen
// but untouched" instead of "off screen".
import { prefersReducedMotion } from './motion.js';
const MAX_DEG = 6;
const LERP = 0.12;
export function attachTilt(root) {
    const inert = { requestMotionPermission: async () => { }, stop() { } };
    if (typeof window === 'undefined')
        return inert;
    if (prefersReducedMotion())
        return inert;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let raf = 0;
    const SETTLE_EPSILON = 0.01;
    function tick() {
        curX += (targetX - curX) * LERP;
        curY += (targetY - curY) * LERP;
        root.style.setProperty('--tilt-rx', `${curX.toFixed(2)}deg`);
        root.style.setProperty('--tilt-ry', `${curY.toFixed(2)}deg`);
        root.style.setProperty('--tilt-tx', `${(curY * 1.6).toFixed(2)}px`);
        root.style.setProperty('--tilt-ty', `${(-curX * 1.6).toFixed(2)}px`);
        const settled = Math.abs(targetX - curX) < SETTLE_EPSILON && Math.abs(targetY - curY) < SETTLE_EPSILON;
        if (settled) {
            raf = 0; // idle until the next pointer/orientation reading calls startLoop() again
        }
        else {
            raf = requestAnimationFrame(tick);
        }
    }
    function startLoop() {
        if (raf || root.hidden)
            return;
        raf = requestAnimationFrame(tick);
    }
    function stopLoop() {
        cancelAnimationFrame(raf);
        raf = 0;
    }
    const visibilityObserver = new MutationObserver(() => {
        if (root.hidden)
            stopLoop();
        else
            startLoop();
    });
    visibilityObserver.observe(root, { attributes: true, attributeFilter: ['hidden'] });
    if (!root.hidden)
        startLoop();
    function onPointerMove(event) {
        if (event.pointerType === 'touch')
            return; // touch drives via device tilt instead
        const nx = (event.clientX / window.innerWidth) * 2 - 1; // -1..1
        const ny = (event.clientY / window.innerHeight) * 2 - 1;
        targetY = nx * MAX_DEG;
        targetX = -ny * MAX_DEG;
        startLoop();
    }
    function onOrientation(event) {
        if (event.beta == null || event.gamma == null)
            return;
        const gamma = Math.max(-30, Math.min(30, event.gamma)); // left/right tilt
        const beta = Math.max(-20, Math.min(50, event.beta - 35)); // pitch, calibrated to a natural hand-held hold
        targetY = (gamma / 30) * MAX_DEG;
        targetX = -(beta / 30) * MAX_DEG;
        startLoop();
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    let motionAttached = false;
    function attachMotion() {
        if (motionAttached)
            return;
        motionAttached = true;
        window.addEventListener('deviceorientation', onOrientation, { passive: true });
    }
    const DOE = window
        .DeviceOrientationEvent;
    // Only iOS 13+ requires the explicit permission prompt; everywhere else
    // that supports the event, it's safe to attach immediately.
    if (typeof window.DeviceOrientationEvent !== 'undefined' && typeof DOE?.requestPermission !== 'function') {
        attachMotion();
    }
    async function requestMotionPermission() {
        try {
            if (typeof DOE?.requestPermission === 'function') {
                const result = await DOE.requestPermission();
                if (result === 'granted')
                    attachMotion();
            }
        }
        catch {
            // Best-effort only — pointer-driven tilt still works everywhere.
        }
    }
    function stop() {
        stopLoop();
        visibilityObserver.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('deviceorientation', onOrientation);
    }
    return { requestMotionPermission, stop };
}
//# sourceMappingURL=tilt.js.map