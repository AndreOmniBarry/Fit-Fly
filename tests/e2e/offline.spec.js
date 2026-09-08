import { expect, test } from '@playwright/test';

async function clearAppDb(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('fit-fly');
        req.onsuccess = resolve;
        req.onerror = reject;
        req.onblocked = resolve;
      })
  );
}

// sw.js only ever registers in a real browser (see
// js/lib/register-service-worker.js — it no-ops under isNativeRuntime()),
// so these run unmodified against the real service worker this app ships,
// not a mock.

test.describe('offline service worker', () => {
  test('registers and takes control, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto('/');
    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    expect(registered).toBe(true);

    expect(consoleErrors).toEqual([]);
  });

  test('a new worker taking control reloads the open tab automatically', async ({ page }) => {
    // The real bug this guards against: skipWaiting()/clients.claim() in
    // sw.js only guarantee the *next* navigation gets a new worker — an
    // already-open tab (exactly what an installed PWA usually is) would
    // otherwise sit on its old index.html/main.js indefinitely.
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // That first load's own clients.claim() just claimed this exact,
    // previously-uncontrolled page — a normal first install, and
    // register-service-worker.js deliberately does *not* wire up a
    // reload for that (see its own comment on why). Reload once for
    // real so the *next* load starts out already-controlled, matching
    // every actual return visit — only then does a later controller
    // hand-off mean a real update.
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);

    // waitForEvent is started *before* the action that triggers it on
    // purpose — reload() fires synchronously inside the dispatched
    // event, so awaiting the evaluate() call first and only then
    // starting to wait for 'load' would race the navigation and could
    // miss it entirely.
    await Promise.all([
      page.waitForEvent('load'),
      // Simulates a newer worker actually taking over from the one
      // already controlling this page — a real update, unlike the
      // initial claim above.
      page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))),
    ]);
  });

  test('the app shell and app icons are precached on install', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    const cachedUrls = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const fitFlyCache = cacheNames.find((name) => name.startsWith('fit-fly-'));
      if (!fitFlyCache) return [];
      const cache = await caches.open(fitFlyCache);
      const requests = await cache.keys();
      return requests.map((req) => new URL(req.url).pathname);
    });

    expect(cachedUrls.some((path) => path.endsWith('/index.html'))).toBe(true);
    expect(cachedUrls.some((path) => path.endsWith('/manifest.json'))).toBe(true);
    expect(cachedUrls.some((path) => path.endsWith('/js/main.js'))).toBe(true);
    expect(cachedUrls.some((path) => path.endsWith('/css/tokens.css'))).toBe(true);
  });

  test('the Hub still loads and works with the network fully cut off', async ({ page, context }) => {
    // First, a real online visit — this is what populates the runtime
    // cache with the rest of the app's module graph (see sw.js's own
    // fetch-handler comment for why one such visit is enough).
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('button', { name: 'Steps' })).toBeVisible();

    // Now cut the network entirely and reload cold — this is the real
    // test: everything the app needs must already be in the cache.
    await context.setOffline(true);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // The reload lands straight in the Hub (the earlier "Skip for now"
    // choice is a real localStorage preference, unaffected by going
    // offline) — confirming the cached shell alone is enough to boot the
    // whole app with no network at all.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Steps' })).toBeVisible();

    // A feature screen too, not just the shell — confirms the eagerly-
    // imported feature modules (steps-view.js and everything it pulls
    // in) really did get cached by the earlier online visit.
    await page.getByRole('button', { name: 'Steps' }).click();
    await expect(page.getByRole('heading', { name: "Today's steps" })).toBeVisible();

    await context.setOffline(false);
    expect(consoleErrors).toEqual([]);
  });
});
