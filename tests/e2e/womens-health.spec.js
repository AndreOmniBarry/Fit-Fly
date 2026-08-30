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

test.describe('women\'s health / cycle tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-womens-health').click();
  });

  test('first visit prompts a PIN setup, not an unlock', async ({ page }) => {
    await expect(page.locator('#whealth-setup-pane')).toBeVisible();
    await expect(page.locator('#whealth-unlock-pane')).toBeHidden();
  });

  test('setting a PIN unlocks straight into the tracker', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();

    await expect(page.getByRole('heading', { name: 'Cycle Tracker' })).toBeVisible();
    await expect(page.locator('#whealth-flow')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('mismatched PINs are rejected with an inline error', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('9999');
    await page.locator('#btn-whealth-pin-set').click();
    await expect(page.locator('#err-whealth-pin-setup')).toBeVisible();
  });

  test('logging an entry, locking, and unlocking with the right PIN shows it decrypted', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();

    await page.locator('#whealth-flow button[data-value="medium"]').click();
    await page.locator('#whealth-symptoms button[data-value="cramps"]').click();
    await page.locator('#whealth-mood button[data-value="okay"]').click();
    await page.locator('#btn-whealth-save').click();

    await expect(page.locator('#whealth-history-list .card').first()).toContainText('medium');
    await expect(page.locator('#whealth-history-list .card').first()).toContainText('Cramps');

    await page.locator('#btn-whealth-lock').click();
    await expect(page.getByRole('heading', { name: 'Fit Fly' })).toBeVisible();

    await page.locator('#btn-home-womens-health').click();
    await expect(page.locator('#whealth-unlock-pane')).toBeVisible();
    await expect(page.locator('#whealth-setup-pane')).toBeHidden();

    await page.locator('#whealth-pin-unlock').fill('4242');
    await page.locator('#btn-whealth-pin-unlock').click();
    await expect(page.locator('#whealth-history-list .card').first()).toContainText('medium');
  });

  test('an incorrect PIN is rejected', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await page.locator('#btn-whealth-lock').click();

    await page.locator('#btn-home-womens-health').click();
    await page.locator('#whealth-pin-unlock').fill('0000');
    await page.locator('#btn-whealth-pin-unlock').click();
    await expect(page.locator('#err-whealth-pin-unlock')).toBeVisible();
    await expect(page.locator('#whealth-unlock-pane')).toBeVisible();
  });

  test('forgetting the PIN deletes everything and returns to PIN setup', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await page.locator('#btn-whealth-save').click(); // log an entry so there's something to lose
    await page.locator('#btn-whealth-lock').click();

    await page.locator('#btn-home-womens-health').click();
    await page.locator('#btn-whealth-pin-forgot').click();
    await expect(page.locator('#whealth-forgot-confirm')).toBeVisible();
    await page.locator('#btn-whealth-forgot-confirm').click();

    await expect(page.locator('#whealth-setup-pane')).toBeVisible();

    // setting a brand new PIN starts with a clean history — the old
    // entry is genuinely gone, not just re-encrypted
    await page.locator('#whealth-pin-new').fill('1111');
    await page.locator('#whealth-pin-confirm').fill('1111');
    await page.locator('#btn-whealth-pin-set').click();
    await expect(page.locator('#whealth-history-list')).toContainText('No entries logged yet');
  });

  test('reloading re-locks the session (the key lives only in memory)', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    // wait for the PIN write to actually land before reloading, or the
    // reload can race ahead of the async save
    await expect(page.locator('#whealth-flow')).toBeVisible();

    await page.reload();
    await page.locator('#btn-home-womens-health').click();
    await expect(page.locator('#whealth-unlock-pane')).toBeVisible();
  });
});
