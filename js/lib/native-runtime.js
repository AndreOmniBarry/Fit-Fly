// Detects whether this code is currently running inside a native wrapper
// (a Capacitor-built iOS/Android app) rather than a plain browser tab or
// installed PWA. Capacitor injects `window.Capacitor` with exactly this
// shape at runtime — checking for it needs no import and no new
// dependency, and is a real, zero-risk feature-detect: `window.Capacitor`
// is `undefined` in every browser context today, so it's provably false
// everywhere this app currently runs. Once the project is wrapped with
// Capacitor, this same check starts returning true with no code change
// here — the same "false in the browser today, real once the platform
// supports it" contract every other feature-detected API in this app
// already follows (SpeechRecognition, Web Bluetooth, camera torch, ...).
//
// This is the seam future native-only features (HealthKit steps/vitals
// on iOS, Health Connect on Android, a real background pedometer, BLE
// that isn't limited to Chrome/Android) gate behind — each reads real
// native data when true, and is a no-op returning null/unsupported when
// false, never a fake reading either way.
export function isNativeRuntime() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}
