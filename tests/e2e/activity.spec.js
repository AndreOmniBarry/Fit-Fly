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
  await page.locator('#ob-experience button[data-value="intermediate"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="build-muscle"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
}

test.describe('activity logging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
  });

  test('logging an activity shows it in history with an ESTIMATED calorie badge', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Log Activity' }).click();
    await expect(page.getByRole('heading', { name: 'Log Activity' })).toBeVisible();

    await page.locator('#activity-type button[data-value="run"]').click();
    await page.locator('#activity-intensity button[data-value="vigorous"]').click();
    await page.locator('#activity-duration').fill('30');
    await page.getByRole('button', { name: 'Save' }).click();

    // saving returns to home
    await expect(page.getByRole('heading', { name: 'Fit Fly' })).toBeVisible();

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

    const entry = page.locator('#activity-history-list .card').first();
    await expect(entry).toContainText('Run');
    await expect(entry).toContainText('30 min');
    await expect(entry.locator('.data-badge.estimated')).toContainText('kcal');

    expect(consoleErrors).toEqual([]);
  });

  test('history is empty state before anything is logged', async ({ page }) => {
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.locator('#activity-history-list')).toContainText('Nothing logged yet');
  });

  test('validation blocks saving without a type or duration', async ({ page }) => {
    await page.getByRole('button', { name: 'Log Activity' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('#err-activity-type')).toBeVisible();
    await expect(page.locator('#err-activity-duration')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Log Activity' })).toBeVisible();
  });

  test('a logged activity survives reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Log Activity' }).click();
    await page.locator('#activity-type button[data-value="yoga"]').click();
    await page.locator('#activity-duration').fill('45');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.reload();
    await page.getByRole('button', { name: 'History' }).click();
    const entry = page.locator('#activity-history-list .card').first();
    await expect(entry).toContainText('Yoga');
    await expect(entry).toContainText('45 min');
  });
});
