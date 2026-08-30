import { expect, test } from '@playwright/test';

// Real-browser IndexedDB has quirks fake-indexeddb (used by the Vitest
// suite) doesn't reproduce — this exercises the actual vendored Dexie
// build against a real IndexedDB implementation.
test('Dexie opens and round-trips a record against real IndexedDB', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('/');

  const result = await page.evaluate(async () => {
    const { createDb } = await import('/js/db/client.js');
    const { saveProfile, getProfile } = await import('/js/db/repositories/profile.js');

    const db = createDb('e2e-real-idb-test');
    await saveProfile({ heightCm: 180 }, db);
    const profile = await getProfile(db);

    db.close();
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('e2e-real-idb-test');
      req.onsuccess = resolve;
      req.onerror = reject;
    });

    return profile;
  });

  expect(result.heightCm).toBe(180);
  expect(result.id).toBe('primary');
  expect(consoleErrors).toEqual([]);
});
