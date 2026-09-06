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

test.describe('vitals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Vitals' }).click();
  });

  test('shows the screen with zero console errors, and both histories start empty', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Blood pressure & oxygen' })).toBeVisible();
    await expect(page.locator('#vitals-bp-history-list')).toContainText('No readings yet');
    await expect(page.locator('#vitals-spo2-history-list')).toContainText('No readings yet');
    await expect(page.locator('#vitals-temp-history-list')).toContainText('No readings yet');
    await expect(page.locator('#vitals-bp-trend-card')).toBeHidden();
    await expect(page.locator('#vitals-spo2-trend-card')).toBeHidden();
    await expect(page.locator('#vitals-temp-trend-card')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('a blood-pressure manual entry saves, categorizes correctly, and surfaces a real trend', async ({ page }) => {
    await page.locator('#vitals-bp-systolic').fill('128');
    await page.locator('#vitals-bp-diastolic').fill('84');
    await page.locator('#btn-vitals-bp-save').click();

    const entry = page.locator('#vitals-bp-history-list .vitals-card').first();
    await expect(entry).toContainText('128/84 mmHg');
    await expect(entry).toContainText('Manual');
    await expect(entry.locator('.vitals-category-badge')).toHaveText('Hypertension Stage 1');

    await expect(page.locator('#vitals-bp-trend-card')).toBeVisible();
    await expect(page.locator('#vitals-bp-trend-latest')).toHaveText('128 / 84 mmHg');
    await expect(page.locator('#vitals-bp-trend-category')).toHaveText('Hypertension Stage 1');
    await expect(page.locator('#vitals-bp-trend-delta')).toHaveText(''); // nothing prior to compare against

    // A second, lower reading — real delta and range.
    await page.locator('#vitals-bp-systolic').fill('118');
    await page.locator('#vitals-bp-diastolic').fill('76');
    await page.locator('#btn-vitals-bp-save').click();
    await expect(page.locator('#vitals-bp-trend-latest')).toHaveText('118 / 76 mmHg');
    await expect(page.locator('#vitals-bp-trend-category')).toHaveText('Normal');
    await expect(page.locator('#vitals-bp-trend-delta')).toHaveText('-10 systolic since last');
    await expect(page.locator('#vitals-bp-trend-range')).toHaveText('118–128 mmHg');
  });

  test('a blood-pressure crisis reading is flagged as concerning', async ({ page }) => {
    await page.locator('#vitals-bp-systolic').fill('185');
    await page.locator('#vitals-bp-diastolic').fill('95');
    await page.locator('#btn-vitals-bp-save').click();

    await expect(page.locator('#vitals-bp-trend-category')).toContainText('Hypertensive Crisis');
    await expect(page.locator('#vitals-bp-trend-category')).toHaveClass(/is-concerning/);
  });

  test('blood-pressure manual entry rejects invalid ranges and a nonsensical pair', async ({ page }) => {
    await page.locator('#vitals-bp-systolic').fill('999');
    await page.locator('#vitals-bp-diastolic').fill('80');
    await page.locator('#btn-vitals-bp-save').click();
    await expect(page.locator('#err-vitals-bp')).toBeVisible();

    // A diastolic higher than systolic is a nonsensical pair, not just an
    // out-of-range single number — also rejected.
    await page.locator('#vitals-bp-systolic').fill('80');
    await page.locator('#vitals-bp-diastolic').fill('120');
    await page.locator('#btn-vitals-bp-save').click();
    await expect(page.locator('#err-vitals-bp')).toBeVisible();
    await expect(page.locator('#vitals-bp-history-list')).toContainText('No readings yet');
  });

  test('an SpO2 manual entry saves, categorizes correctly, and surfaces a real trend', async ({ page }) => {
    await page.locator('#vitals-spo2-percent').fill('97');
    await page.locator('#btn-vitals-spo2-save').click();

    const entry = page.locator('#vitals-spo2-history-list .vitals-card').first();
    await expect(entry).toContainText('97%');
    await expect(entry).toContainText('Manual');
    await expect(entry.locator('.vitals-category-badge')).toHaveText('Normal');

    await expect(page.locator('#vitals-spo2-trend-card')).toBeVisible();
    await expect(page.locator('#vitals-spo2-trend-latest')).toHaveText('97%');
    await expect(page.locator('#vitals-spo2-trend-category')).toHaveText('Normal');
  });

  test('a low SpO2 reading is flagged as concerning', async ({ page }) => {
    await page.locator('#vitals-spo2-percent').fill('88');
    await page.locator('#btn-vitals-spo2-save').click();

    await expect(page.locator('#vitals-spo2-trend-category')).toContainText('seek care');
    await expect(page.locator('#vitals-spo2-trend-category')).toHaveClass(/is-concerning/);
  });

  test('SpO2 manual entry rejects an out-of-range value', async ({ page }) => {
    await page.locator('#vitals-spo2-percent').fill('40');
    await page.locator('#btn-vitals-spo2-save').click();
    await expect(page.locator('#err-vitals-spo2')).toBeVisible();
    await expect(page.locator('#vitals-spo2-history-list')).toContainText('No readings yet');
  });

  test('a body-temperature manual entry saves, categorizes correctly, and surfaces a real trend', async ({ page }) => {
    await page.locator('#vitals-temp-fahrenheit').fill('101.5');
    await page.locator('#btn-vitals-temp-save').click();

    const entry = page.locator('#vitals-temp-history-list .vitals-card').first();
    await expect(entry).toContainText('101.5°F');
    await expect(entry).toContainText('Manual');
    await expect(entry.locator('.vitals-category-badge')).toHaveText('Fever');

    await expect(page.locator('#vitals-temp-trend-card')).toBeVisible();
    await expect(page.locator('#vitals-temp-trend-latest')).toHaveText('101.5°F');
    await expect(page.locator('#vitals-temp-trend-category')).toHaveText('Fever');
    await expect(page.locator('#vitals-temp-trend-delta')).toHaveText(''); // nothing prior to compare against

    // A second, lower reading — real delta and range, back in Celsius
    // internally but shown in °F throughout.
    await page.locator('#vitals-temp-fahrenheit').fill('98.6');
    await page.locator('#btn-vitals-temp-save').click();
    await expect(page.locator('#vitals-temp-trend-latest')).toHaveText('98.6°F');
    await expect(page.locator('#vitals-temp-trend-category')).toHaveText('Normal');
    await expect(page.locator('#vitals-temp-trend-delta')).toHaveText('-2.9°F since last');
    await expect(page.locator('#vitals-temp-trend-range')).toHaveText('98.6°F–101.5°F');
  });

  test('a high-fever reading is flagged as concerning, and a hypothermia-range reading too', async ({ page }) => {
    await page.locator('#vitals-temp-fahrenheit').fill('104');
    await page.locator('#btn-vitals-temp-save').click();

    await expect(page.locator('#vitals-temp-trend-category')).toContainText('High fever');
    await expect(page.locator('#vitals-temp-trend-category')).toHaveClass(/is-concerning/);

    await page.locator('#vitals-temp-fahrenheit').fill('93');
    await page.locator('#btn-vitals-temp-save').click();
    await expect(page.locator('#vitals-temp-trend-category')).toContainText('Hypothermia');
    await expect(page.locator('#vitals-temp-trend-category')).toHaveClass(/is-concerning/);
  });

  test('body-temperature manual entry rejects an out-of-range value', async ({ page }) => {
    await page.locator('#vitals-temp-fahrenheit').fill('150');
    await page.locator('#btn-vitals-temp-save').click();
    await expect(page.locator('#err-vitals-temp')).toBeVisible();
    await expect(page.locator('#vitals-temp-history-list')).toContainText('No readings yet');
  });

  test('logging a BP, an SpO2, and a body-temperature reading updates the combined streak and week count', async ({ page }) => {
    await expect(page.locator('#vitals-stat-streak')).toHaveText('0');
    await expect(page.locator('#vitals-stat-week-count')).toHaveText('0');

    await page.locator('#vitals-bp-systolic').fill('115');
    await page.locator('#vitals-bp-diastolic').fill('75');
    await page.locator('#btn-vitals-bp-save').click();
    await page.locator('#vitals-spo2-percent').fill('98');
    await page.locator('#btn-vitals-spo2-save').click();
    await page.locator('#vitals-temp-fahrenheit').fill('98.6');
    await page.locator('#btn-vitals-temp-save').click();

    // Same day counts once toward the streak, but all three readings still
    // count toward "this week".
    await expect(page.locator('#vitals-stat-streak')).toHaveText('1', { timeout: 3000 });
    await expect(page.locator('#vitals-stat-week-count')).toHaveText('3', { timeout: 3000 });
  });

  test('Bluetooth sections degrade gracefully when unsupported', async ({ page }) => {
    const bluetoothSupported = await page.evaluate(() => 'bluetooth' in navigator);
    if (bluetoothSupported) {
      await expect(page.locator('#btn-vitals-bp-ble-connect')).toBeEnabled();
      await expect(page.locator('#btn-vitals-spo2-ble-connect')).toBeEnabled();
      await expect(page.locator('#btn-vitals-temp-ble-connect')).toBeEnabled();
    } else {
      await expect(page.locator('#vitals-bp-ble-status')).toContainText('use a manual entry instead');
      await expect(page.locator('#btn-vitals-bp-ble-connect')).toBeDisabled();
      await expect(page.locator('#vitals-spo2-ble-status')).toContainText('use a manual entry instead');
      await expect(page.locator('#btn-vitals-spo2-ble-connect')).toBeDisabled();
      await expect(page.locator('#vitals-temp-ble-status')).toContainText('use a manual entry instead');
      await expect(page.locator('#btn-vitals-temp-ble-connect')).toBeDisabled();
    }
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-vitals-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-vitals'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
