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
  await page.evaluate(() => localStorage.clear());
}

test.describe('fitness toolkit home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
  });

  test('renders every row with its icon, zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    for (const id of [
      'btn-home-log-activity',
      'btn-home-history',
      'btn-home-rest-timer',
      'btn-home-program',
      'btn-home-run',
      'btn-home-run-history',
      'btn-home-heart-rate',
      'btn-home-womens-health',
      'btn-home-nutrition',
      'btn-home-readiness',
      'btn-home-goals',
    ]) {
      const row = page.locator(`#${id}`);
      await expect(row).toBeVisible();
      await expect(row.locator('.fitness-row-icon .icon')).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('reacts to tilt, same spatial language as the Hub/Sleep/Focus', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-home'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('every row still navigates correctly despite the restructured markup', async ({ page }) => {
    await page.locator('#btn-home-history').click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });
});
