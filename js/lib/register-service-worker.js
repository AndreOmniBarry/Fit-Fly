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

  // sw.js's own skipWaiting()/clients.claim() only guarantee that the
  // *next* navigation gets the new worker — an already-open tab keeps
  // running whatever index.html/main.js it already loaded into memory,
  // update or not. That's exactly what an installed PWA usually is: a
  // tab that stays open for days without a real reload. So reload once,
  // automatically, the moment a new worker actually takes control —
  // this is what makes an update land without someone needing to know
  // to force-quit and reopen the app.
  //
  // controllerchange is *not* the "only fires on a real update" signal
  // it might look like: clients.claim() in sw.js's own activate handler
  // also claims this exact page on its very first-ever visit (this page
  // load started with no controller at all, and just got one) — that's
  // a completely normal first install, not an update, and reloading for
  // it would just be a pointless double-load the very first time anyone
  // opens the app. `navigator.serviceWorker.controller` read right now,
  // before registration even happens, is what tells those two cases
  // apart: non-null here means this page load already started under an
  // existing worker's control, so any *later* controllerchange really is
  // a hand-off to a newer one — worth reloading for. Null means this
  // load has no worker yet, so whatever claims it first is an install,
  // not an update, and is deliberately left unlistened-for.
  const hadControllerAlready = navigator.serviceWorker.controller != null;

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

  if (hadControllerAlready) {
    // The `reloaded` guard is belt-and-suspenders in case the browser
    // ever fires this more than once for the same hand-off.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }
}
