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
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
}

test.describe('readiness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-readiness').click();
  });

  test('a full check-in produces a score, category badge, and reasoning', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Readiness' })).toBeVisible();
    await expect(page.locator('#readiness-result')).toBeHidden();

    await page.locator('#readiness-sleep').fill('8');
    await page.locator('#readiness-energy button[data-value="5"]').click();
    await page.locator('#readiness-soreness button[data-value="1"]').click();
    await page.locator('#btn-readiness-save').click();

    await expect(page.locator('#readiness-result')).toBeVisible();
    await expect(page.locator('#readiness-category')).toContainText('high');
    await expect(page.locator('#readiness-score')).toContainText('/ 100');
    await expect(page.locator('#readiness-reasoning li').first()).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('a poor night produces a low-readiness result with reasoning that mentions sleep', async ({ page }) => {
    await page.locator('#readiness-sleep').fill('4');
    await page.locator('#readiness-energy button[data-value="1"]').click();
    await page.locator('#readiness-soreness button[data-value="5"]').click();
    await page.locator('#btn-readiness-save').click();

    await expect(page.locator('#readiness-category')).toContainText('low');
    await expect(page.locator('#readiness-reasoning')).toContainText('Sleep');
  });

  test('validation blocks an empty check-in', async ({ page }) => {
    await page.locator('#btn-readiness-save').click();
    await expect(page.locator('#err-readiness')).toBeVisible();
    await expect(page.locator('#readiness-result')).toBeHidden();
  });

  test('shows up in recent history, and a second save the same day overwrites rather than duplicates', async ({ page }) => {
    await page.locator('#readiness-sleep').fill('7');
    await page.locator('#readiness-energy button[data-value="3"]').click();
    await page.locator('#btn-readiness-save').click();
    await expect(page.locator('#readiness-history-list .card')).toHaveCount(1);

    await page.locator('#readiness-sleep').fill('8');
    await page.locator('#btn-readiness-save').click();
    await expect(page.locator('#readiness-history-list .card')).toHaveCount(1);
  });

  test('revisiting the same day prefills the earlier answers', async ({ page }) => {
    await page.locator('#readiness-sleep').fill('7.5');
    await page.locator('#readiness-energy button[data-value="4"]').click();
    await page.locator('#readiness-soreness button[data-value="2"]').click();
    await page.locator('#btn-readiness-save').click();

    await page.locator('#btn-readiness-back').click();
    await page.locator('#btn-home-readiness').click();

    await expect(page.locator('#readiness-sleep')).toHaveValue('7.5');
    await expect(page.locator('#readiness-energy button[data-value="4"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#readiness-result')).toBeVisible();
  });
});
