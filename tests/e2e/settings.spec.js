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
