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

test.describe('skipping onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('Skip for now lands straight in the Hub, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Focus' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('Sleep works fully without ever onboarding', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await expect(page.locator('#sleep-score-value')).toHaveText('100');
  });

  test('the skip is remembered across a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the Fitness Toolkit shows a profile-setup banner instead of blank targets', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await expect(page.locator('#fitness-toolkit-no-profile-banner')).toBeVisible();
    await expect(page.locator('#fitness-toolkit-no-profile-banner')).toContainText('Set up your profile');
  });

  test('setting up a profile from the banner clears it on return', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.locator('#btn-fitness-toolkit-setup-profile').click();

    await expect(page.getByRole('heading', { name: 'The basics' })).toBeVisible();
    await page.locator('#ob-birthdate').fill('1994-05-20');
    await page.locator('#ob-sex button[data-value="female"]').click();
    await page.locator('#ob-height-cm').fill('168');
    await page.locator('#ob-weight-kg').fill('64');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#ob-active-days button[data-value="4"]').click();
    await page.locator('#ob-experience button[data-value="intermediate"]').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#ob-goal button[data-value="build-muscle"]').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#ob-has-injury button[data-value="no"]').click();
    await page.getByRole('button', { name: 'See my plan' }).click();
    await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();

    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await expect(page.locator('#fitness-toolkit-no-profile-banner')).toBeHidden();
  });
});
