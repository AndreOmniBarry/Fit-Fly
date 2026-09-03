// Registers sw.js (see its own header comment for the caching strategy).
// Feature-detected and best-effort like every other browser API this app
// touches: unsupported browsers, and — deliberately — a real Capacitor
// native build (isNativeRuntime()) just skip this entirely. The native
// app's assets are bundled straight into the APK/IPA at build time (see
// "Native builds (Capacitor)" in the README); a browser-style HTTP cache
// on top of that would be pure, pointless overhead, not a real gap.
import { isNativeRuntime } from './native-runtime.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || isNativeRuntime()) return;

  // Registering after 'load' keeps the very first paint/interaction off
  // the critical path — this is a pure offline-durability improvement,
  // never something the initial render should wait on.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Best-effort: a failed registration (an unsupported browser
      // quirk, a blocked scope, ...) just means this session behaves
      // exactly as it always has — no offline guarantee, nothing else
      // breaks.
    });
  });
}
