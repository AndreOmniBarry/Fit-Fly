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

test.describe('hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Hydration' }).click();
  });

  test('shows the screen with zero console errors, starting empty', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Stay hydrated' })).toBeVisible();
    await expect(page.locator('#hydration-today-ml')).toHaveText('0');
    await expect(page.locator('#hydration-goal-label')).toHaveText('of 2,200ml goal');
    await expect(page.locator('#hydration-history-list')).toContainText('No drinks logged yet today');

    const height = await page.locator('#hydration-water-fill').getAttribute('height');
    expect(parseFloat(height)).toBe(0); // honestly empty — no water logged yet

    expect(consoleErrors).toEqual([]);
  });

  test('a quick-log tap adds a real serving and fills the figure', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="500"]').click();

    await expect(page.locator('#hydration-today-ml')).toHaveText('500', { timeout: 3000 });
    const entry = page.locator('#hydration-history-list .hydration-card').first();
    await expect(entry).toContainText('500ml');

    const height = await page.locator('#hydration-water-fill').getAttribute('height');
    expect(parseFloat(height)).toBeGreaterThan(0); // real progress drawn in, not decorative
  });

  test('multiple entries in one day sum into the running total', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="250"]').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('250', { timeout: 3000 });

    await page.locator('.hydration-quick-log-btn[data-ml="500"]').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('750', { timeout: 3000 });

    await expect(page.locator('#hydration-history-list .hydration-card')).toHaveCount(2);
  });

  test('a custom amount is validated before logging', async ({ page }) => {
    await page.locator('#hydration-custom-ml').fill('0');
    await page.locator('#btn-hydration-custom-save').click();
    await expect(page.locator('#err-hydration-custom')).toBeVisible();

    await page.locator('#hydration-custom-ml').fill('9000');
    await page.locator('#btn-hydration-custom-save').click();
    await expect(page.locator('#err-hydration-custom')).toBeVisible();
    await expect(page.locator('#hydration-history-list')).toContainText('No drinks logged yet today');

    await page.locator('#hydration-custom-ml').fill('330');
    await page.locator('#btn-hydration-custom-save').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('330', { timeout: 3000 });
  });

  test('logging a day updates the streak and 7-day average', async ({ page }) => {
    await expect(page.locator('#hydration-stat-streak')).toHaveText('0');

    await page.locator('.hydration-quick-log-btn[data-ml="750"]').click();

    await expect(page.locator('#hydration-stat-streak')).toHaveText('1', { timeout: 3000 });
    await expect(page.locator('#hydration-stat-avg')).toHaveText('750', { timeout: 3000 });
  });

  test('setting a custom daily goal updates the label and re-scales the fill', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="500"]').click();
    await expect(page.locator('#hydration-today-ml')).toHaveText('500', { timeout: 3000 });
    const heightBefore = await page.locator('#hydration-water-fill').getAttribute('height');

    await page.locator('#hydration-goal-input').fill('1000');
    await page.locator('#btn-hydration-goal-save').click();
    await expect(page.locator('#hydration-goal-label')).toHaveText('of 1,000ml goal');

    const heightAfter = await page.locator('#hydration-water-fill').getAttribute('height');
    expect(parseFloat(heightAfter)).toBeGreaterThan(parseFloat(heightBefore)); // same 500ml is a bigger share of a smaller goal
  });

  test('the reminder interval control is hidden until notifications are enabled', async ({ page }) => {
    await expect(page.locator('#hydration-interval-row')).toBeHidden();
    await expect(page.locator('#hydration-notify-status')).toContainText('Not enabled yet');
  });

  test('the Hub tile updates with a real streak after logging', async ({ page }) => {
    await page.locator('.hydration-quick-log-btn[data-ml="250"]').click();
    await page.locator('#btn-hydration-back').click();

    await expect(page.locator('#hub-hydration-sub')).toHaveText('1-day streak', { timeout: 3000 });
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-hydration-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-hydration'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});

test.describe('hydration: notifications enabled', () => {
  test.use({ permissions: ['notifications'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Hydration' }).click();
  });

  test('shows notifications as already enabled, hides the enable button, and reveals the interval control', async ({
    page,
  }) => {
    await expect(page.locator('#hydration-notify-status')).toContainText('Enabled');
    await expect(page.locator('#btn-hydration-enable-notify')).toBeHidden();
    await expect(page.locator('#hydration-interval-row')).toBeVisible();
  });

  test('the reminder interval persists across a reload', async ({ page }) => {
    await page.locator('#hydration-interval-hours').fill('4');
    await page.locator('#hydration-interval-hours').dispatchEvent('change');
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    await expect(page.locator('#hydration-interval-hours')).toHaveValue('4');
  });

  test('a real reminder fires on load once the interval has passed and today\'s goal is unmet', async ({ page }) => {
    // Force the "last reminder" further back than the interval, so the
    // check-on-open logic is guaranteed to decide a reminder is due —
    // regardless of whatever the app's own check already did on this
    // test's initial load, before the notification proxy existed to
    // observe it. The proxy has to go in via addInitScript, before any
    // page script runs on the reload, same reason goals.spec.js's own
    // reminder test does the same.
    await page.evaluate(() => {
      const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      localStorage.setItem('fitfly:lastHydrationReminderAt', old);
    });

    await page.addInitScript(() => {
      window.__notificationTitle = null;
      const OriginalNotification = window.Notification;
      window.Notification = new Proxy(OriginalNotification, {
        construct(target, args) {
          window.__notificationTitle = args[0];
          return new target(...args);
        },
      });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Hydration' }).click();

    await expect.poll(() => page.evaluate(() => window.__notificationTitle)).toContain('Time for some water');
  });
});
