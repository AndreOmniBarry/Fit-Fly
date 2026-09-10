// Fit Fly's offline service worker — makes "works fully offline once
// loaded" (see README's "Platform notes") literally true, instead of an
// accident of the browser's own opportunistic HTTP cache (which mobile
// browsers routinely evict, especially for an installed PWA that hasn't
// been opened in a while).
//
// Strategy, deliberately simple for a bundler-free app with no build step:
//   1. Install: precache a small, hand-listed "app shell" — the files a
//      cold start needs before main.js has even run (this file's own
//      dependencies: index.html, the CSS, the font stylesheet,
//      manifest.json, the app icons, and js/main.js itself). This is what
//      guarantees a freshly-installed PWA can boot with zero network,
//      even before a person has ever opened it while online... well,
//      almost — see the fetch handler below for why one online visit is
//      still needed, and why that's enough.
//   2. Fetch: same-origin GET requests are served cache-first (instant,
//      and correct offline) with a silent background revalidation
//      (stale-while-revalidate) that keeps the cache fresh whenever the
//      network is actually available. main.js statically imports
//      essentially this app's entire feature set up front (see
//      js/main.js), so the ES module graph the browser resolves on the
//      very first real page load already fetches nearly every .js file
//      the app has — this handler catches each one on the way past and
//      caches it, with no manifest of "every file" to hand-maintain here.
//      Everything else (exercise SVGs, vendored fonts/libraries) is
//      cached the same way, opportunistically, the first time it's
//      actually used.
//
// There's no build step here to fingerprint these files automatically
// (see README's "no bundler" section), so a browser's update-check for
// this service worker — a byte-for-byte diff of this very file against
// what's installed — needs CACHE_VERSION below to actually change on
// every real deploy, or no browser ever sees a reason to install a new
// worker and skipWaiting()/clients.claim() never run.
//
// This used to be a hand-maintained string, and that failed badly, twice:
// CACHE_VERSION sat at 'v1' through this entire project's early build
// history (every deploy shipped real changes to index.html/main.js/the
// CSS, but this file itself never changed, so no installed PWA ever
// picked up a single one of them), and after that was first noticed and
// bumped to 'v2', it then sat unbumped again through 26 further commits
// and 13 merged feature PRs — the exact same silent-staleness failure
// recurring because "remember to bump this by hand" is not a real
// process, it's a hope. scripts/stamp-sw-cache-version.mjs (wired into
// vercel.json's buildCommand) replaces the placeholder below with the
// real commit SHA on every actual deploy now, so there is no "remember"
// step left standing between a real deploy and a real cache-busting
// version — every deploy is definitionally a new commit, so every
// deploy is definitionally a new CACHE_VERSION. The 'dev' placeholder
// only ever ships from a local `npm run serve` that skipped the stamp
// script (or a checkout with no build step at all) — never from Vercel.
//
// Bumping this alone is still only half the fix: it makes the diff
// meaningful, but the browser has to actually fetch this file from the
// network to diff it against in the first place. A CDN or the browser's
// own HTTP cache serving a stale copy of sw.js defeats the update check
// just as completely as a never-changing CACHE_VERSION did — see
// vercel.json's headers entry for /sw.js (Cache-Control: no-store),
// which is what guarantees this specific file is never served stale.
const CACHE_VERSION = 'dev';
const CACHE_NAME = `fit-fly-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/mini-apps.css',
  './js/vendor/fonts/fonts.css',
  './js/main.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      // Take over from any previously-waiting service worker immediately
      // rather than leaving a person on an old cached shell until every
      // tab closes — this app has no unsaved-work-in-a-tab risk that
      // makes that trade-off dangerous (every write goes straight to
      // IndexedDB, see "Data layer").
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only same-origin GET requests are ours to cache. Nearly every
  // third-party library is vendored locally (see js/vendor/
  // THIRD_PARTY_NOTICES.md) with nothing cross-origin left to fetch at
  // runtime — Open Food Facts' food search is the one remaining
  // exception, and this app has no server to POST to, but pass anything
  // unexpected straight through untouched rather than trying to cache
  // it. That exception manages its own caching (the browser's own HTTP
  // cache) — duplicating that here would just be a second, redundant
  // copy.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          // Only cache real, complete responses — an opaque or error
          // response cached here would otherwise be served back forever.
          if (response && response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline, or the request failed outright: fall back to whatever's cached, if anything

      // Cache-first when there's already a cached copy (instant, and the
      // only thing that actually works offline) while quietly
      // revalidating in the background; otherwise this is the first time
      // this file has ever been requested, so wait on the network.
      return cached || network;
    })
  );
});
