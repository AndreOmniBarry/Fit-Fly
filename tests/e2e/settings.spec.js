import { readFile } from 'node:fs/promises';
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

async function readDownloadedBackup(download) {
  const path = await download.path();
  return JSON.parse(await readFile(path, 'utf8'));
}

test.describe('settings: export/import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('shows the screen with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export a backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore from a backup' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-settings-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('exporting downloads a real backup file containing this device\'s data', async ({ page }) => {
    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('4321');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('4321', { timeout: 3000 });
    await page.locator('#btn-steps-back').click();
    await page.getByRole('button', { name: 'Settings' }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export a backup' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^fit-fly-backup-\d{4}-\d{2}-\d{2}\.json$/);

    const backup = await readDownloadedBackup(download);
    expect(backup.app).toBe('fit-fly');
    expect(Array.isArray(backup.tables.stepEntries)).toBe(true);
    expect(backup.tables.stepEntries.some((row) => row.steps === 4321)).toBe(true);

    await expect(page.locator('#settings-export-status')).toContainText('Saved');
  });

  test('importing a backup replaces this device\'s data and reloads', async ({ page }) => {
    // Log a real value, export it as the backup we'll restore later.
    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('1000');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('1000', { timeout: 3000 });
    await page.locator('#btn-steps-back').click();
    await page.getByRole('button', { name: 'Settings' }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export a backup' }).click(),
    ]);
    const backupPath = await download.path();

    // Now change the on-device data so the restore is a real, visible change.
    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('9999');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-today-count')).toHaveText('9999', { timeout: 3000 });
    await page.locator('#btn-steps-back').click();
    await page.getByRole('button', { name: 'Settings' }).click();

    await page.locator('#settings-import-file').setInputFiles(backupPath);
    await expect(page.locator('#settings-import-confirm')).toBeVisible();
    await page.locator('#btn-settings-import-confirm').click();
    await expect(page.locator('#settings-import-success')).toContainText('Restored');

    // The reload this triggers ~1.2s later is the real assertion — the
    // whole app has to come back up clean afterward, with the restored
    // (not the overwritten) value. onboardingSkipped is itself a real
    // pref that just got restored from the backup, so the reload lands
    // straight in the Hub, same as offline.spec.js's own reload case.
    await page.waitForEvent('load', { timeout: 5000 });
    await page.getByRole('button', { name: 'Steps' }).click();
    await expect(page.locator('#steps-today-count')).toHaveText('1000', { timeout: 5000 });
  });

  test('cancelling the confirm step discards the pending import, no data changes', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export a backup' }).click(),
    ]);
    const backupPath = await download.path();

    await page.locator('#settings-import-file').setInputFiles(backupPath);
    await expect(page.locator('#settings-import-confirm')).toBeVisible();
    await page.locator('#btn-settings-import-cancel').click();
    await expect(page.locator('#settings-import-confirm')).toBeHidden();
    await expect(page.locator('#settings-import-success')).toBeHidden();
  });

  test('rejects a file that is not a real backup, with a clear inline error', async ({ page }) => {
    const badFile = {
      name: 'not-a-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('this is not json at all {{{'),
    };
    await page.locator('#settings-import-file').setInputFiles(badFile);
    await expect(page.locator('#err-settings-import')).toBeVisible();
    await expect(page.locator('#err-settings-import')).toContainText("isn't readable");
    await expect(page.locator('#settings-import-confirm')).toBeHidden();
  });
});

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

test.describe('settings: profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('with no profile set up yet, the form starts honestly empty, not fabricated defaults', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.locator('#profile-birthdate')).toHaveValue('');
    await expect(page.locator('#profile-age-hint')).toHaveText('');
    await expect(page.locator('#profile-height-cm')).toHaveValue('');
    await expect(page.locator('#profile-weight-kg')).toHaveValue('');
  });

  test('saving a first-time profile from Settings works with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();

    await page.locator('#profile-birthdate').fill('2000-01-15');
    await page.locator('#profile-sex button[data-value="male"]').click();
    await page.locator('#profile-height-cm').fill('180');
    await page.locator('#profile-weight-kg').fill('75');
    await page.locator('#btn-profile-save').click();

    await expect(page.locator('#profile-save-status')).toHaveText('Saved.');
    expect(consoleErrors).toEqual([]);
  });

  test('rejects saving with a required field missing', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();

    await page.locator('#profile-height-cm').fill('180');
    await page.locator('#profile-weight-kg').fill('75');
    await page.locator('#btn-profile-save').click();

    await expect(page.locator('#err-profile-birthdate')).toBeVisible();
    await expect(page.locator('#err-profile-sex')).toBeVisible();
    await expect(page.locator('#profile-save-status')).toHaveText('');
  });

  test('an existing profile from onboarding loads with a real, derived age', async ({ page }) => {
    await completeOnboarding(page);
    await page.locator('#btn-hub-settings').click();

    await expect(page.locator('#profile-birthdate')).toHaveValue('1994-05-20');
    await expect(page.locator('#profile-age-hint')).toContainText('years old');
    await expect(page.locator('#profile-sex button[data-value="female"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#profile-height-cm')).toHaveValue('168');
    await expect(page.locator('#profile-weight-kg')).toHaveValue('64.0');
  });

  test('switching units converts the already-loaded real values, not just clearing them', async ({ page }) => {
    await completeOnboarding(page);
    await page.locator('#btn-hub-settings').click();

    await page.locator('#profile-units button[data-value="imperial"]').click();
    // 168 cm = 5'6", 64 kg ≈ 141.1 lb
    await expect(page.locator('#profile-height-ft')).toHaveValue('5');
    await expect(page.locator('#profile-height-in')).toHaveValue('6');
    await expect(page.locator('#profile-weight-lb')).toHaveValue('141.1');
  });

  test('editing weight in imperial units saves correctly and ripples through to another screen live', async ({
    page,
  }) => {
    await completeOnboarding(page);
    await page.locator('#btn-hub-settings').click();

    await page.locator('#profile-units button[data-value="imperial"]').click();
    await page.locator('#profile-weight-lb').fill('150'); // ~68.04 kg
    await page.locator('#btn-profile-save').click();
    await expect(page.locator('#profile-save-status')).toHaveText('Saved.');

    // A different screen's own live calorie estimate reads the profile
    // fresh on every render — no separate "refresh" step should be
    // needed for the new weight to actually change its real math.
    await page.locator('#btn-settings-back').click();
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('9000');
    await page.locator('#btn-steps-manual-save').click();
    await expect(page.locator('#steps-active-energy')).toContainText('kcal today');
    const text = await page.locator('#steps-active-energy').textContent();
    const kcal = Number(text.match(/~(\d+) kcal/)[1]);
    // At 64kg this would be 355 kcal (verified elsewhere) — the new,
    // heavier weight must produce a real, higher number, not the same one.
    expect(kcal).toBeGreaterThan(355);
  });
});
