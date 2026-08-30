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

test.describe('onboarding wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('a full happy-path run lands on a category with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Get Started' }).click();

    // Step 1: basics
    await expect(page.getByRole('heading', { name: 'The basics' })).toBeVisible();
    await page.locator('#ob-birthdate').fill('1994-05-20');
    await page.locator('#ob-sex button[data-value="female"]').click();
    await page.locator('#ob-height-cm').fill('168');
    await page.locator('#ob-weight-kg').fill('64');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: activity
    await expect(page.getByRole('heading', { name: "Where you're starting from" })).toBeVisible();
    await page.locator('#ob-active-days button[data-value="4"]').click();
    await page.locator('#ob-experience button[data-value="intermediate"]').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: goal
    await expect(page.getByRole('heading', { name: 'What are you working toward?' })).toBeVisible();
    await page.locator('#ob-goal button[data-value="build-muscle"]').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: safety — no red flags, no other injury
    await expect(page.getByRole('heading', { name: 'A quick safety check' })).toBeVisible();
    await page.locator('#ob-has-injury button[data-value="no"]').click();
    await page.getByRole('button', { name: 'See my plan' }).click();

    // Step 5: result
    await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
    await expect(page.locator('#ob-result-category')).toHaveText('Hypertrophy');
    await expect(page.locator('#ob-result-reasoning li')).toHaveCount(1);
    await expect(page.locator('#ob-result-review-banner')).toBeHidden();

    await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();

    // Home
    await expect(page.locator('#home-category-badge')).toHaveText('Hypertrophy');

    expect(consoleErrors).toEqual([]);
  });

  test('a red flag routes to rehab-recuperation and shows the professional-review banner', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    await page.locator('#ob-birthdate').fill('1985-03-01');
    await page.locator('#ob-sex button[data-value="prefer-not-to-say"]').click();
    await page.locator('#ob-height-cm').fill('180');
    await page.locator('#ob-weight-kg').fill('82');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#ob-active-days button[data-value="3"]').click();
    await page.locator('#ob-experience button[data-value="intermediate"]').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#ob-goal button[data-value="endurance"]').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#ob-redflags button[data-value="chest-pain-pressure"]').click();
    await page.locator('#ob-has-injury button[data-value="no"]').click();
    await page.getByRole('button', { name: 'See my plan' }).click();

    await expect(page.locator('#ob-result-category')).toHaveText('Rehab & Recuperation');
    await expect(page.locator('#ob-result-review-banner')).toBeVisible();
  });

  test('required-field validation blocks advancing and shows inline errors', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('#err-ob-birthdate')).toBeVisible();
    await expect(page.locator('#err-ob-sex')).toBeVisible();
    await expect(page.locator('#err-ob-height')).toBeVisible();
    await expect(page.locator('#err-ob-weight')).toBeVisible();
    // still on step 1 — did not advance
    await expect(page.getByRole('heading', { name: 'The basics' })).toBeVisible();
  });

  test('switching to imperial units swaps the height/weight fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.locator('#ob-height-metric')).toBeVisible();
    await expect(page.locator('#ob-height-imperial')).toBeHidden();

    await page.locator('#ob-units button[data-value="imperial"]').click();

    await expect(page.locator('#ob-height-imperial')).toBeVisible();
    await expect(page.locator('#ob-weight-imperial')).toBeVisible();
    await expect(page.locator('#ob-height-metric')).toBeHidden();
  });

  test('reloading after finishing onboarding goes straight to home', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.locator('#ob-birthdate').fill('2000-01-01');
    await page.locator('#ob-sex button[data-value="male"]').click();
    await page.locator('#ob-height-cm').fill('175');
    await page.locator('#ob-weight-kg').fill('70');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#ob-active-days button[data-value="5"]').click();
    await page.locator('#ob-experience button[data-value="advanced"]').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#ob-goal button[data-value="endurance"]').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#ob-has-injury button[data-value="no"]').click();
    await page.getByRole('button', { name: 'See my plan' }).click();
    await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();

    await page.reload();
    await expect(page.locator('#home-category-badge')).toHaveText('Endurance');
  });
});
