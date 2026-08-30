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

async function completeOnboarding(page) {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.locator('#ob-birthdate').fill('1994-05-20');
  await page.locator('#ob-sex button[data-value="female"]').click();
  await page.locator('#ob-height-cm').fill('168');
  await page.locator('#ob-weight-kg').fill('64');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-active-days button[data-value="4"]').click();
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="endurance"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
}

test.describe('heart rate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-heart-rate').click();
  });

  test('a manual entry is saved as MEASURED and shows up in recent readings', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Heart Rate' })).toBeVisible();
    await page.locator('#hr-manual-bpm').fill('68');
    await page.locator('#btn-hr-manual-save').click();

    const entry = page.locator('#hr-history-list .card').first();
    await expect(entry).toContainText('68 bpm');
    await expect(entry).toContainText('Manual');
    await expect(entry.locator('.data-badge.measured')).toHaveText('measured');

    expect(consoleErrors).toEqual([]);
  });

  test('manual entry rejects an out-of-range value', async ({ page }) => {
    await page.locator('#hr-manual-bpm').fill('999');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#err-hr-manual')).toBeVisible();
  });

  test('recent readings is empty before anything is recorded', async ({ page }) => {
    await expect(page.locator('#hr-history-list')).toContainText('No readings yet');
  });

  test('Bluetooth section degrades gracefully when unsupported', async ({ page }) => {
    const bluetoothSupported = await page.evaluate(() => 'bluetooth' in navigator);
    if (bluetoothSupported) {
      await expect(page.locator('#btn-hr-ble-connect')).toBeEnabled();
    } else {
      await expect(page.locator('#hr-ble-status')).toContainText('use the camera or a manual entry instead');
      await expect(page.locator('#btn-hr-ble-connect')).toBeDisabled();
    }
  });

  test('a camera reading runs the full capture pipeline against the fake device', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-hr-camera-start').click();
    await expect(page.locator('#hr-camera-progress')).toBeVisible();
    await expect(page.locator('#btn-hr-camera-start')).toBeDisabled();

    // The fake video device is a synthetic test pattern, not a real pulse,
    // so this can legitimately end in either a result or a "couldn't get a
    // clear reading" message — the point of this test is that the whole
    // getUserMedia -> canvas-sampling -> signal-processing pipeline runs
    // to completion without throwing, either way.
    await expect(page.locator('#btn-hr-camera-start')).toBeEnabled({ timeout: 25000 });
    await expect(page.locator('#hr-camera-progress')).toBeHidden();

    const resultVisible = await page.locator('#hr-camera-result').isVisible();
    const errorVisible = await page.locator('#hr-camera-error').isVisible();
    expect(resultVisible || errorVisible).toBe(true);

    expect(consoleErrors).toEqual([]);
  });
});
