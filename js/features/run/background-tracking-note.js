// Pure copy logic, deliberately separated from run-tracker.js's DOM
// wiring — see js/lib/native-runtime.js for the isNativeRuntime() seam
// this reads, and the domain-boundary audit for why this file exists on
// its own: it's the one piece of Run's "how do we track in the
// background" story that isn't itself a DOM/platform-API wrapper, so it
// can sit next to the pure logic instead of inside the view file.
import { isNativeRuntime } from '../../lib/native-runtime.js';

// The web platform's real limit here — no service worker keeps a GPS
// watch alive once the app isn't the foregrounded, active tab, so
// tracking needs the screen open and awake (see js/lib/wake-lock.js).
// Once this project is wrapped with Capacitor, a real native background-
// geolocation plugin removes that limit — js/lib/native-runtime.js's
// isNativeRuntime() is the seam that becomes true then, with no code
// change needed here beyond this message. Provably false in every
// browser context today, same contract as every other feature-detected
// API in this app.
export function backgroundTrackingNote() {
  return isNativeRuntime()
    ? 'This device tracks your run in the background — you can lock the screen or switch apps.'
    : "Keep this screen open and awake while you run — a web app can't track your route once the screen locks or you switch apps.";
}
